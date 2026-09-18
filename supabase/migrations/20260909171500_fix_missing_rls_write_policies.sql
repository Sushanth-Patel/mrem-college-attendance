-- Fix missing RLS write policies for sections, profiles, branches, subjects, and period_slots (error 42501)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sections' AND policyname = 'Admin Full Access on sections') THEN
        CREATE POLICY "Admin Full Access on sections" ON sections FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Admin Full Access on branches') THEN
        CREATE POLICY "Admin Full Access on branches" ON branches FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'Admin Full Access on subjects') THEN
        CREATE POLICY "Admin Full Access on subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'period_slots' AND policyname = 'Admin Full Access on period_slots') THEN
        CREATE POLICY "Admin Full Access on period_slots" ON period_slots FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admin Full Access on profiles') THEN
        CREATE POLICY "Admin Full Access on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
