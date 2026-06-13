-- Drop the overly broad UNIQUE constraint that blocks DM room creation
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS uq_room_name_type;

-- Clear old sticker data if any
DELETE FROM stickers;
DELETE FROM sticker_packs;

-- Seed Sticker Packs
INSERT INTO sticker_packs (id, name, cover_file_key, created_at)
VALUES ('b47a06c5-4dce-4be9-8df0-7d7211bfb9b9', 'Meow Pack', 'stickers/packs/meow/cover.png', CURRENT_TIMESTAMP);

INSERT INTO sticker_packs (id, name, cover_file_key, created_at)
VALUES ('c3b7a5a8-20bf-4aeb-9876-0bf17f0a1c1c', 'Pepe Pack', 'stickers/packs/pepe/cover.png', CURRENT_TIMESTAMP);

-- Seed Stickers for Meow Pack
INSERT INTO stickers (id, pack_id, name, file_key, format_type)
VALUES
('d11b3333-1111-4444-9999-000000000001', 'b47a06c5-4dce-4be9-8df0-7d7211bfb9b9', 'Meow Smile', 'stickers/packs/meow/smile.png', 'PNG'),
('d11b3333-1111-4444-9999-000000000002', 'b47a06c5-4dce-4be9-8df0-7d7211bfb9b9', 'Meow Cry', 'stickers/packs/meow/cry.png', 'PNG');

-- Seed Stickers for Pepe Pack
INSERT INTO stickers (id, pack_id, name, file_key, format_type)
VALUES
('d22b4444-2222-5555-8888-000000000001', 'c3b7a5a8-20bf-4aeb-9876-0bf17f0a1c1c', 'Pepe Sad', 'stickers/packs/pepe/sad.png', 'PNG');
