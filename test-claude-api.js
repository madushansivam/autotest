import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 100,
  messages: [
    { role: 'user', content: 'Reply with exactly one sentence confirming you received this test message.' }
  ],
});

console.log(response.content[0].text);
