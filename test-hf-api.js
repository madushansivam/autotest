import 'dotenv/config';
import { InferenceClient } from '@huggingface/inference';

const client = new InferenceClient(process.env.API_KEY);

const response = await client.chatCompletion({
  model: 'meta-llama/Llama-3.1-8B-Instruct',
  messages: [
    { role: 'user', content: 'Reply with exactly one sentence confirming you received this test message.' }
  ],
  max_tokens: 100,
});

console.log(response.choices[0].message.content);
