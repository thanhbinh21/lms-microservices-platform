# Nâng Cấp AI Quiz Và Chatbot Thành Learning Agent

## Summary
- Mục tiêu: biến AI từ “gọi model trả lời” thành trợ lý học tập có context, tool nội bộ, kiểm soát chất lượng và UX đủ dùng cho học viên.
- Ưu tiên 1: làm quiz cuối khóa đủ chuẩn để xét chứng chỉ, không sinh câu hỏi trùng/lỏng/chung chung.
- Ưu tiên 2: nâng chatbot thành Learning Agent bám khóa học, được mở rộng kiến thức nền liên quan và nói rõ khi là phần tham khảo.
- Ưu tiên 3: polish UI/UX AI Chat và Quiz, đồng thời sửa text mojibake trong phạm vi AI/learn bị ảnh hưởng.

## Key Changes
- Thêm `AI Context Pack` từ course-service: gom course title/description/category/level, chapter title, lesson title/content, AUTO_CONTEXT/manual/subtitle nếu có; trả thêm `coverage`, `quality`, `missingFields`.
- Áp dụng chuẩn context tối thiểu cho quiz:
  - Lesson quiz: lesson phải có seed context đủ rõ từ title/chapter/course/content/keywords.
  - Final quiz: yêu cầu coverage đủ rộng trên nhiều bài học; nếu không đủ thì trả lỗi hướng dẫn bổ sung nội dung, không tạo quiz chứng chỉ bằng metadata quá mỏng.
- Nâng chatbot thành internal-tool agent:
  - Tool bắt buộc: course context pack, current lesson context, student progress/completion, quiz history, conversation memory, lexical course-context search.
  - Không thêm live web search trong batch này.
  - Agent flow: classify intent → gọi tool → chọn context → trả lời ngắn gọn → self-check scope/hallucination → lưu message.
- Nâng quiz thành assessment agent:
  - Tạo blueprint trước khi sinh câu hỏi: lesson quiz 5 câu, final quiz 15 câu, trộn nhớ/hiểu/vận dụng.
  - Sinh nhiều candidate hơn số cần, rồi lọc duplicate question/options, option set trùng, đáp án đúng lệch quá nhiều, câu hỏi quá chung.
  - Thêm LLM critic pass với rubric đánh giá; nếu thiếu câu đạt chuẩn thì regenerate có mục tiêu một lần.
  - Final quiz fail-fast nếu không đủ câu đạt chuẩn; không dùng static fallback vô nghĩa.

## API / Interface Changes
- Giữ endpoint hiện có để backward compatible: `/ai/api/chat/*`, `/ai/api/quiz/*`, `/internal/quiz/check`.
- Bổ sung optional metadata trong response:
  - Chat SSE thêm `agent_step` và `done.sources`.
  - Quiz generate thêm `contextQuality`, `coverage`, `qualityReport`, `warnings`.
- Ai DB migration:
  - `AiMessage`: thêm optional `sources Json`, `metadata Json`.
  - `AiQuizSession`: thêm optional `contextSnapshot Json`, `blueprint Json`, `qualityReport Json`.
- Frontend types trong `apps/web-client/src/app/actions/ai.ts` cập nhật các field optional, UI cũ vẫn chạy nếu field không có.

## UI/UX Changes
- Chat:
  - Refactor ChatWidget thành panel/drawer học tập: desktop cạnh phải, mobile full-screen.
  - Thêm suggested prompts theo bài học, context badge, source chips, stop/retry/copy, markdown/code rendering.
  - Truyền `currentTimeSec` từ VideoPlayer cho upload video; YouTube để undefined.
  - Prompt mặc định ép trả lời cô đọng: trả lời trực tiếp, ví dụ ngắn, bước học tiếp theo.
- Quiz:
  - Final quiz page có navigation grid, trạng thái đã trả lời, confirm trước nộp, timer rõ.
  - Result hiển thị câu hỏi, đáp án đã chọn, đáp án đúng, giải thích, gợi ý học lại chương/bài liên quan.
  - Empty/error state nói rõ vì sao chưa tạo được quiz và instructor cần bổ sung gì.
- Sửa toàn bộ text mojibake trong phạm vi AI chat/quiz/learn touched files sang tiếng Việt có dấu tự nhiên.

## Test Plan
- Unit tests ai-service:
  - context quality/coverage calculator.
  - quiz duplicate detector.
  - option validator.
  - answer distribution checker.
  - JSON parsing + retry behavior.
- Integration tests with mocked LLM:
  - Chat hỏi theo bài học → agent gọi đúng tools và trả lời có source.
  - Chat hỏi ngoài scope → từ chối hoặc chuyển về phạm vi khóa học.
  - Lesson quiz context đủ → tạo 5 câu đạt quality.
  - Final quiz context mỏng → 422, không tạo session.
  - Final quiz đủ context nhưng LLM sinh trùng → filter/regenerate.
  - Submit expired/double-submit/forbidden vẫn giữ behavior hiện có.
- Manual QC:
  - Học xong 100% nhưng chưa pass quiz → không cấp chứng chỉ.
  - Pass final quiz ≥70% → cấp chứng chỉ.
  - AI service down → certificate gate vẫn chặn đúng.
  - Desktop/mobile chat và quiz không tràn text, không lỗi mojibake.
- Build/check:
  - `pnpm --filter @lms/ai-service prisma:generate`
  - `pnpm --filter @lms/ai-service build`
  - `pnpm --filter @lms/course-service build`
  - `pnpm --filter web-client build`

## Assumptions
- Chọn chuẩn context “yêu cầu tối thiểu”: không bắt transcript video, nhưng không cho quiz chứng chỉ sinh từ metadata quá nghèo.
- Chatbot được mở rộng kiến thức nền liên quan khóa học, nhưng phải gắn nhãn “phần mở rộng tham khảo” khi vượt khỏi text khóa học.
- Agent dùng tool nội bộ của hệ thống, chưa thêm live web/RAG vector trong batch này.
- Giữ provider chain hiện tại của ai-service; trọng tâm là orchestration, context, validator và UI, không đổi nhà cung cấp model.
- Sau khi implement cần cập nhật `project_overview.md` roadmap và tạo/cập nhật tài liệu kỹ thuật trong `output/` vì có migration + thay đổi AI flow.
