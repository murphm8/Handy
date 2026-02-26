use aws_config::BehaviorVersion;
use aws_sdk_bedrockruntime::{
    config::Region,
    types::{ContentBlock, ConversationRole, Message, SystemContentBlock},
    Client,
};
use log::{error, info};

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

    let mut loader = aws_config::defaults(BehaviorVersion::latest());

    if let Some(profile) = profile_name {
        info!("Using AWS profile: '{}'", profile);
        loader = loader.profile_name(profile);
    }

    loader = loader.region(Region::new(region.to_string()));

    let sdk_config = loader.load().await;
    let client = Client::new(&sdk_config);

    let system = system_prompt.map(|text| vec![SystemContentBlock::Text(text.to_string())]);

    let user_message = Message::builder()
        .role(ConversationRole::User)
        .content(ContentBlock::Text(user_prompt.to_string()))
        .build()
        .map_err(|e| {
            error!("Failed to build message: {}", e);
            format!("Failed to build message: {}", e)
        })?;

    let mut request = client
        .converse()
        .model_id(model_id)
        .messages(user_message);

    if let Some(sys) = system {
        request = request.set_system(Some(sys));
    }

    let response = request.send().await.map_err(|e| {
        error!("Bedrock API call failed: {:?}", e);
        map_bedrock_error(e, model_id, region)
    })?;

    let output = response.output.ok_or_else(|| {
        error!("Bedrock returned an empty response");
        "Bedrock returned an empty response".to_string()
    })?;

    let message = match output {
        aws_sdk_bedrockruntime::types::ConverseOutput::Message(msg) => msg,
        _ => {
            error!("Unexpected response type from Bedrock");
            return Err("Unexpected response type from Bedrock".to_string());
        }
    };

    let content = message.content.first().ok_or_else(|| {
        error!("Bedrock response contains no content");
        "Bedrock response contains no content".to_string()
    })?;

    match content {
        ContentBlock::Text(text) => {
            info!(
                "Successfully received text response from Bedrock ({} chars)",
                text.len()
            );
            Ok(text.clone())
        }
        _ => {
            error!("Bedrock response is not text");
            Err("Bedrock response is not text".to_string())
        }
    }
}

fn map_bedrock_error(
    error: aws_sdk_bedrockruntime::error::SdkError<
        aws_sdk_bedrockruntime::operation::converse::ConverseError,
    >,
    _model_id: &str,
    _region: &str,
) -> String {
    let msg = format!("Bedrock API error: {}", error);
    error!("{}", msg);
    msg
}
