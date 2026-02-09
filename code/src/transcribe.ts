import { WHISPER_URL } from "./config.js";

const API = `${WHISPER_URL}/gradio_api`;

export async function transcribe(audioBuffer: Buffer, filename: string): Promise<string> {
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" });

  // Step 1: Upload file to Gradio
  const uploadForm = new FormData();
  uploadForm.append("files", blob, filename);

  const uploadRes = await fetch(`${API}/upload`, {
    method: "POST",
    body: uploadForm,
  });

  if (!uploadRes.ok) {
    throw new Error(`Whisper upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const uploaded = (await uploadRes.json()) as string[];
  const filePath = uploaded[0];

  // Step 2: Call /transcribe_file — async Gradio endpoint (call + poll)
  const callRes = await fetch(`${API}/call/transcribe_file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        [{ path: filePath, orig_name: filename, meta: { _type: "gradio.FileData" } }],
        "",       // input_folder_path
        false,    // include_subdirectory
        true,     // save_same_dir
        "txt",    // file_format (plain text, no timestamps)
        false,    // add_timestamp
        "large-v3",  // model
        "polish", // language
        false,    // translate
        5,        // beam_size
        -1,       // log_prob_threshold
        0.6,      // no_speech_threshold
        "float16",// compute_type
        5,        // best_of
        1,        // patience
        true,     // condition_on_previous_text
        0.5,      // prompt_reset_on_temperature
        null,     // initial_prompt
        0,        // temperature
        2.4,      // compression_ratio_threshold
        1,        // length_penalty
        1.2,      // repetition_penalty
        0,        // no_repeat_ngram_size
        null,     // prefix
        true,     // suppress_blank
        "[-1]",   // suppress_tokens
        1,        // max_initial_timestamp
        false,    // word_timestamps
        "\"'\"¿([{-",    // prepend_punctuations
        "\"'.。,，!！?？:：\")]}、", // append_punctuations
        64,       // max_new_tokens
        3,        // chunk_length
        null,     // hallucination_silence_threshold
        null,     // hotwords
        0.5,      // language_detection_threshold
        1,        // language_detection_segments
        24,       // batch_size
        true,     // offload_sub_model
        true,     // enable_vad
        0.3,      // speech_threshold
        100,      // min_speech_duration_ms
        2000,     // max_speech_duration_s
        1000,     // min_silence_duration_ms
        2000,     // speech_padding_ms
        false,    // enable_diarization
        "cuda",   // device
        "",       // hf_token
        true,     // offload_sub_model_2
        false,    // enable_bgm_remover
        "UVR-MDX-NET-Inst_HQ_4", // bgm_model
        "cuda",   // bgm_device
        256,      // segment_size
        false,    // save_separated
        true,     // offload_sub_model_3
      ],
    }),
  });

  if (!callRes.ok) {
    throw new Error(`Whisper call failed: ${callRes.status} ${await callRes.text()}`);
  }

  const { event_id } = (await callRes.json()) as { event_id: string };

  // Step 3: Poll SSE stream for result
  const resultRes = await fetch(`${API}/call/transcribe_file/${event_id}`);
  if (!resultRes.ok) {
    throw new Error(`Whisper result failed: ${resultRes.status} ${await resultRes.text()}`);
  }

  const body = await resultRes.text();
  // SSE stream has multiple events (progress, complete). Find the "complete" event's data.
  const lines = body.split("\n");
  let completeData: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "event: complete" && i + 1 < lines.length && lines[i + 1].startsWith("data: ")) {
      completeData = lines[i + 1].slice(6);
      break;
    }
  }

  if (!completeData) {
    // Check for error event
    const errorLine = lines.find(l => l === "event: error");
    if (errorLine) {
      const errorData = lines[lines.indexOf(errorLine) + 1];
      throw new Error(`Whisper error: ${errorData}`);
    }
    throw new Error(`No complete event in Whisper response: ${body.slice(0, 500)}`);
  }

  const data = JSON.parse(completeData) as unknown[];
  // First element is: "Done in Xs! ...\n----\n<filename>\n\n<transcription>\n"
  const raw = typeof data[0] === "string" ? data[0] : "";
  // Strip everything before and including the "----" separator + filename line
  const separatorIdx = raw.indexOf("----");
  let text: string;
  if (separatorIdx !== -1) {
    const afterSep = raw.slice(separatorIdx + 4).trim();
    // First line after separator is the filename (e.g. "voice"), skip it
    const lines = afterSep.split("\n");
    text = lines.slice(1).join("\n").trim();
  } else {
    text = raw.trim();
  }

  if (!text) {
    throw new Error(`Whisper returned empty transcription: ${raw}`);
  }

  return text;
}
