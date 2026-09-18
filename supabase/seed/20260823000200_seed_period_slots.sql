-- Period Slots Seeding (PRD §5)
-- Reference timetable: 8 fixed periods per day, Monday–Saturday
-- 1. 09:30–10:20
-- 2. 10:20–11:10
-- (Break: 11:10–11:20)
-- 3. 11:20–12:10
-- 4. 12:10–13:00
-- (Lunch: 13:00–13:40)
-- 5. 13:40–14:30
-- 6. 14:30–15:20
-- 7. 15:20–16:10

INSERT INTO period_slots (period_number, start_time, end_time, label)
VALUES
    (1, '09:30:00', '10:20:00', 'Period 1'),
    (2, '10:20:00', '11:10:00', 'Period 2'),
    (3, '11:20:00', '12:10:00', 'Period 3'),
    (4, '12:10:00', '13:00:00', 'Period 4'),
    (5, '13:40:00', '14:30:00', 'Period 5'),
    (6, '14:30:00', '15:20:00', 'Period 6'),
    (7, '15:20:00', '16:10:00', 'Period 7')
ON CONFLICT (period_number) DO UPDATE
SET start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    label = EXCLUDED.label;
