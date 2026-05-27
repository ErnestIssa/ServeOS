-- Add IMAGE to chat message types (customer photo messages).
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'IMAGE';
