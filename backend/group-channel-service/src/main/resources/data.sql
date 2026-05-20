-- Drop the overly broad UNIQUE constraint that blocks DM room creation
-- All DM rooms share name='DM' and type='DM', so the constraint must be removed
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS uq_room_name_type;
