use aws_config::BehaviorVersion;
use aws_sdk_bedrockruntime::{
    config::Region,
    types::{
        ContentBlock, ConversationRole, Message, SpecificToolChoice, SystemContentBlock, Tool,
        ToolChoice, ToolConfiguration, ToolInputSchema, ToolSpecification,
    },
    Client,
};
use aws_smithy_types::Document;
use log::{debug, error, info};

/// Field name used for the structured output tool
const TRANSCRIPTION_FIELD: &str = "transcription";
/// Tool name for structured output
const TOOL_NAME: &str = "transcription_output";

/// Build a shared Bedrock client from profile + region.
async fn build_client(profile_name: Option<&str>, region: &str) -> Client {
    let mut loader = aws_config::defaults(BehaviorVersion::latest());

    if let Some(profile) = profile_name {
        info!("Using AWS profile: '{}'", profile);
        loader = loader.profile_name(profile);
    }

    loader = loader.region(Region::new(region.to_string()));
    let sdk_config = loader.load().await;
    Client::new(&sdk_config)
}

/// Convert a `serde_json::Value` into an `aws_smithy_types::Document`.
fn json_to_document(value: &serde_json::Value) -> Document {
    match value {
        serde_json::Value::Null => Document::Null,
        serde_json::Value::Bool(b) => Document::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Document::Number(aws_smithy_types::Number::NegInt(i))
            } else if let Some(u) = n.as_u64() {
                Document::Number(aws_smithy_types::Number::PosInt(u))
            } else if let Some(f) = n.as_f64() {
                Document::Number(aws_smithy_types::Number::Float(f))
            } else {
                Document::Null
            }
        }
        serde_json::Value::String(s) => Document::String(s.clone()),
        serde_json::Value::Array(arr) => {
            Document::Array(arr.iter().map(json_to_document).collect())
        }
        serde_json::Value::Object(obj) => Document::Object(
            obj.iter()
                .map(|(k, v)| (k.clone(), json_to_document(v)))
                .collect(),
        ),
    }
}

/// Extract a string field from a `Document::Object`.
fn extract_string_field(doc: &Document, field: &str) -> Option<String> {
    if let Document::Object(map) = doc {
        if let Some(Document::String(s)) = map.get(field) {
            return Some(s.clone());
        }
    }
    None
}

/// Send a plain (non-structured) completion request to Bedrock.
pub async fn send_bedrock_completion(
    profile_name: Option<&str>,
    region: &str,
    model_id: &str,
    system_prompt: Option<&str>,
    user_prompt: &str,
) -> Result<String, String> {
    info!(
        "Starting Bedrock completion request - profile: {:?}, region: {}, model: {}",
        profile_name, region, model_id
    );

    let client = build_client(profile_name, region).await;

    let system = system_prompt.map(|text| vec![SystemContentBlock::Text(text.to_string())]);

    let user_message = Message::builder()
        .role(ConversationRole::User)
        .content(ContentBlock::Text(user_prompt.to_string()))
        .build()
        .map_err(|e| {
            error!("Failed to build message: {}", e);
            format!("Failed to build message: {}", e)
        })?;

    let mut request = client.converse().model_id(model_id).messages(user_message);

    if let Some(sys) = system {
        request = request.set_system(Some(sys));
    }

    let response = request.send().await.map_err(|e| {
        error!("Bedrock API call failed: {:?}", e);
        map_bedrock_error(e)
    })?;

    extract_text_from_response(response)
}

/// Send a structured output request to Bedrock using tool use.
///
/// Defines a tool with the transcription JSON schema and forces the model
/// to call it via `ToolChoice::Tool`. The transcription text is extracted
/// from the tool's input document.
pub async fn send_bedrock_structured_completion(
    profile_name: Option<&str>,
    region: &str,
    model_id: &str,
    system_prompt: Option<&str>,
    user_prompt: &str,
) -> Result<String, String> {
    info!(
        "Starting Bedrock structured completion - profile: {:?}, region: {}, model: {}",
        profile_name, region, model_id
    );

    let client = build_client(profile_name, region).await;

    let system = system_prompt.map(|text| vec![SystemContentBlock::Text(text.to_string())]);

    let user_message = Message::builder()
        .role(ConversationRole::User)
        .content(ContentBlock::Text(user_prompt.to_string()))
        .build()
        .map_err(|e| format!("Failed to build message: {}", e))?;

    // Build the JSON schema as a Document
    let schema_json = serde_json::json!({
        "type": "object",
        "properties": {
            TRANSCRIPTION_FIELD: {
                "type": "string",
                "description": "The cleaned and processed transcription text"
            }
        },
        "required": [TRANSCRIPTION_FIELD],
        "additionalProperties": false
    });
    let schema_doc = json_to_document(&schema_json);

    let tool_spec = ToolSpecification::builder()
        .name(TOOL_NAME)
        .description("Output the processed transcription text")
        .input_schema(ToolInputSchema::Json(schema_doc))
        .build()
        .map_err(|e| format!("Failed to build tool spec: {}", e))?;

    let tool_choice = ToolChoice::Tool(
        SpecificToolChoice::builder()
            .name(TOOL_NAME)
            .build()
            .map_err(|e| format!("Failed to build tool choice: {}", e))?,
    );

    let tool_config = ToolConfiguration::builder()
        .tools(Tool::ToolSpec(tool_spec))
        .tool_choice(tool_choice)
        .build()
        .map_err(|e| format!("Failed to build tool config: {}", e))?;

    let mut request = client
        .converse()
        .model_id(model_id)
        .messages(user_message)
        .tool_config(tool_config);

    if let Some(sys) = system {
        request = request.set_system(Some(sys));
    }

    let response = request.send().await.map_err(|e| {
        error!("Bedrock structured API call failed: {:?}", e);
        map_bedrock_error(e)
    })?;

    // Extract tool use result
    let output = response
        .output
        .ok_or_else(|| "Bedrock returned an empty response".to_string())?;

    let message = match output {
        aws_sdk_bedrockruntime::types::ConverseOutput::Message(msg) => msg,
        _ => return Err("Unexpected response type from Bedrock".to_string()),
    };

    // Look for ToolUse content block
    for block in &message.content {
        if let ContentBlock::ToolUse(tool_use) = block {
            if tool_use.name == TOOL_NAME {
                if let Some(text) = extract_string_field(&tool_use.input, TRANSCRIPTION_FIELD) {
                    debug!("Bedrock structured output succeeded ({} chars)", text.len());
                    return Ok(text);
                } else {
                    error!("Tool use input missing '{}' field", TRANSCRIPTION_FIELD);
                    // Fall through to try text extraction
                }
            }
        }
    }

    // Fallback: try to extract plain text if tool use failed
    debug!("No tool use block found, falling back to text extraction");
    extract_text_from_content(&message.content)
}

/// Extract text from a Converse response.
fn extract_text_from_response(
    response: aws_sdk_bedrockruntime::operation::converse::ConverseOutput,
) -> Result<String, String> {
    let output = response
        .output
        .ok_or_else(|| "Bedrock returned an empty response".to_string())?;

    let message = match output {
        aws_sdk_bedrockruntime::types::ConverseOutput::Message(msg) => msg,
        _ => return Err("Unexpected response type from Bedrock".to_string()),
    };

    extract_text_from_content(&message.content)
}

/// Extract text from content blocks.
fn extract_text_from_content(content: &[ContentBlock]) -> Result<String, String> {
    for block in content {
        if let ContentBlock::Text(text) = block {
            info!(
                "Successfully received text response from Bedrock ({} chars)",
                text.len()
            );
            return Ok(text.clone());
        }
    }
    Err("Bedrock response contains no text content".to_string())
}

fn map_bedrock_error(
    error: aws_sdk_bedrockruntime::error::SdkError<
        aws_sdk_bedrockruntime::operation::converse::ConverseError,
    >,
) -> String {
    let msg = format!("Bedrock API error: {}", error);
    error!("{}", msg);
    msg
}
