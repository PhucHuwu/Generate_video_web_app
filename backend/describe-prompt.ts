// Shared image description prompt used by Gemini and OpenRouter fallbacks.
export const DESCRIBE_IMAGE_PROMPT = `Describe the person in the image in clear, natural English.
Focus strictly on what is visually present.
Include details about:
- the person’s physical appearance
- facial expression
- clothing
- body posture and gesture
- immediate surroundings and environment
- objects they are interacting with (if any)
Do NOT add assumptions, extra actions, emotions, or context that cannot be directly seen in the image.
Return only the descriptive paragraph, without any notes or explanations.
The description must be realistic and strictly grounded in the image.`;

export default DESCRIBE_IMAGE_PROMPT;
