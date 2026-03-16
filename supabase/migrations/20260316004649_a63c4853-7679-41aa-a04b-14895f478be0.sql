
-- Fix 1: Update replacement session numbers to match original (same number, not +1)
UPDATE sessions SET session_number = 12 WHERE id = '892e8791-5435-4e5b-a4bf-65bc87fe4dfe';
UPDATE sessions SET session_number = 7 WHERE id = '6475e1a6-88b5-4835-bf32-340d39ee46e6';
UPDATE sessions SET session_number = 6 WHERE id = 'ddcf8563-0674-4f8b-9584-a97798d42f02';
UPDATE sessions SET session_number = 11 WHERE id = '43a9b828-88fd-4e2f-97f0-d23bfbdf3860';
UPDATE sessions SET session_number = 11 WHERE id = 'ca9cf67b-2b45-4cdf-9a08-6ac6ee1dd757';
UPDATE sessions SET session_number = 7 WHERE id = '0ec67985-31ff-489f-9a7c-4c1a4dc69a93';
UPDATE sessions SET session_number = 8 WHERE id = '94eeb916-f2fa-4c5a-a6eb-6dd3b6842653';
UPDATE sessions SET session_number = 6 WHERE id = '00029907-f0fa-4cbf-9e83-2830979aa31f';
UPDATE sessions SET session_number = 6 WHERE id = '54b0ca10-1b9e-41a5-a881-12a6471108ed';
UPDATE sessions SET session_number = 12 WHERE id = '7c3b0aef-28c9-4ae1-a016-83ef28338698';
UPDATE sessions SET session_number = 10 WHERE id = '987c0c1f-4eb7-45c5-9c00-5b21252831aa';
UPDATE sessions SET session_number = 12 WHERE id = '69e01adf-fec3-44ec-87f9-0d1d8b2a163e';

-- Fix 2: Decrement owed_sessions_count by 1 for each affected group
UPDATE groups SET owed_sessions_count = GREATEST(COALESCE(owed_sessions_count, 0) - 1, 0)
WHERE id IN (
  'a9714b0b-efac-47a7-975a-74f3ae3d42a5',
  '16f111ad-3dbe-4bad-a51a-863289280d98',
  'aa50ab8d-7d6f-4aa5-926e-dc3e5d445ca2',
  '05b81214-bbd0-47c0-bde5-8d8a80b699f3',
  'afe56e85-eea7-4061-9d8f-f963c66317cf',
  'c7f98fc6-2f99-4c93-a46d-752f6c176c29',
  '8e54da41-b9eb-41d2-8d76-d5cbb38732d4',
  'b848c293-e8bc-413a-9b0f-c9ca03cef78b',
  'b0a5bfa2-e268-4758-aa78-92a219dc32ad',
  '803b3d52-1d27-4711-bd48-f8a11d7ef133',
  '4468ecc0-17fe-4722-a560-20395e4ca088',
  'ff6f3d60-3d11-4c1b-a578-ca6ed4f219c3'
);
