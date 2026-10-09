
DO $$
DECLARE
  q RECORD;
  new_pos public.question_option;
  opts text[];
  correct_text text;
  target_text text;
  idx_correct int;
  idx_new int;
BEGIN
  FOR q IN SELECT id, correct_option, option_a, option_b, option_c, option_d FROM public.questions LOOP
    new_pos := (ARRAY['A','B','C','D']::public.question_option[])[1 + floor(random()*4)::int];
    IF new_pos = q.correct_option THEN
      CONTINUE;
    END IF;
    opts := ARRAY[q.option_a, q.option_b, q.option_c, q.option_d];
    idx_correct := CASE q.correct_option WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 END;
    idx_new := CASE new_pos WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 END;
    correct_text := opts[idx_correct];
    target_text := opts[idx_new];
    opts[idx_new] := correct_text;
    opts[idx_correct] := target_text;
    UPDATE public.questions
      SET option_a = opts[1], option_b = opts[2], option_c = opts[3], option_d = opts[4],
          correct_option = new_pos
      WHERE id = q.id;
  END LOOP;
END $$;
