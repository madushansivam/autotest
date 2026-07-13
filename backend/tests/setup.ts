// Jest global test setup
// Load .env.example values for tests so modules that call config.ts
// don't throw on missing env vars.
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
process.env.INTERNAL_DOMAIN_BLOCKLIST = 'internal.example.com';
process.env.MAX_PAGES_PER_RUN = '8';
process.env.MAX_LLM_CALLS_PER_RUN = '20';
