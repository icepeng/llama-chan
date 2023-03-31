// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use llama_rs::{InferenceParameters, InferenceSession, Model, Vocabulary};
use rand::SeedableRng;
use std::{convert::Infallible, io::Write, sync::Mutex};
use tauri::Manager;

static NUM_CTX_TOKENS: usize = 2048;
static REPEAT_LAST_N: usize = 64;
static NUM_PREDICT: Option<usize> = None;

pub struct Llama {
    pub model: Option<Model>,
    pub session: Option<InferenceSession>,
    pub rng: Option<rand::rngs::StdRng>,
    pub vocab: Option<Vocabulary>,
}

unsafe impl Send for Llama {}

#[derive(serde::Deserialize)]
#[derive(Debug)]
struct DeserializedInferenceParameters {
    n_batch: usize,
    top_k: usize,
    top_p: f32,
    repeat_penalty: f32,
    temp: f32,
}

impl Llama {
    pub fn load_model(&mut self, model_path: &str, num_ctx_tokens: usize) {
        let (model, vocab) =
            llama_rs::Model::load(&model_path, num_ctx_tokens as i32, |progress| {
                use llama_rs::LoadProgress;
                match progress {
                    LoadProgress::HyperparametersLoaded(hparams) => {
                        log::debug!("Loaded HyperParams {hparams:#?}")
                    }
                    LoadProgress::BadToken { index } => {
                        log::info!("Warning: Bad token in vocab at index {index}")
                    }
                    LoadProgress::ContextSize { bytes } => log::info!(
                        "ggml ctx size = {:.2} MB\n",
                        bytes as f64 / (1024.0 * 1024.0)
                    ),
                    LoadProgress::MemorySize { bytes, n_mem } => log::info!(
                        "Memory size: {} MB {}",
                        bytes as f32 / 1024.0 / 1024.0,
                        n_mem
                    ),
                    LoadProgress::PartLoading {
                        file,
                        current_part,
                        total_parts,
                    } => log::info!(
                        "Loading model part {}/{} from '{}'\n",
                        current_part,
                        total_parts,
                        file.to_string_lossy(),
                    ),
                    LoadProgress::PartTensorLoaded {
                        current_tensor,
                        tensor_count,
                        ..
                    } => {
                        if current_tensor % 8 == 0 {
                            log::info!("Loaded tensor {current_tensor}/{tensor_count}");
                        }
                    }
                    LoadProgress::PartLoaded {
                        file,
                        byte_size,
                        tensor_count,
                    } => {
                        log::info!("Loading of '{}' complete", file.to_string_lossy());
                        log::info!(
                            "Model size = {:.2} MB / num tensors = {}",
                            byte_size as f64 / 1024.0 / 1024.0,
                            tensor_count
                        );
                    }
                }
            })
            .expect("Could not load model");

        self.model = Some(model);
        self.vocab = Some(vocab);

        log::info!("Model fully loaded!");
    }

    pub fn start_session(&mut self, repeat_last_n: usize) {
        match &self.model {
            Some(model) => {
                self.rng = Some(rand::rngs::StdRng::from_entropy());
                self.session = Some(model.start_session(repeat_last_n));
            }
            None => (),
        }
    }

    pub fn inference_with_prompt(
        &mut self,
        inference_params: &InferenceParameters,
        prompt: &str,
        num_predict: Option<usize>,
        app_handle: tauri::AppHandle,
    ) -> Result<(), llama_rs::InferenceError> {
        if self.model.is_none()
            || self.vocab.is_none()
            || self.session.is_none()
            || self.rng.is_none()
        {
            log::info!("Model not loaded yet!");
            return Ok(());
        }

        let model = self.model.as_ref().unwrap();
        let vocab = self.vocab.as_ref().unwrap();
        let session = self.session.as_mut().unwrap();
        let mut rng = self.rng.as_mut().unwrap();

        let res = session.inference_with_prompt::<Infallible>(
            &model,
            &vocab,
            &inference_params,
            &prompt,
            num_predict,
            &mut rng,
            |t| {
                print!("{t}");
                app_handle
                    .emit_all("message", t.to_string().as_str())
                    .unwrap();
                std::io::stdout().flush().unwrap();

                Ok(())
            },
        );

        match res {
            Ok(_) => Ok(()),
            Err(llama_rs::InferenceError::ContextFull) => {
                log::warn!("Context window full, stopping inference.");
                Ok(())
            }
            Err(llama_rs::InferenceError::UserCallback(_)) => unreachable!("cannot fail"),
        }
    }
}

pub struct LlamaState(Mutex<Llama>);

#[tauri::command]
fn load_model(model_path: &str, state: tauri::State<LlamaState>) {
    let mut state = state.0.lock().unwrap();
    state.load_model(model_path, NUM_CTX_TOKENS);
    state.start_session(REPEAT_LAST_N);
}

#[tauri::command]
async fn send_message(
    message: &str,
    inference_parameters: DeserializedInferenceParameters,
    state: tauri::State<'_, LlamaState>,
    app_handle: tauri::AppHandle,
) -> Result<(), ()> {
    let params = InferenceParameters {
        n_threads: num_cpus::get_physical() as i32,
        n_batch: inference_parameters.n_batch,
        top_k: inference_parameters.top_k,
        top_p: inference_parameters.top_p,
        repeat_penalty: inference_parameters.repeat_penalty,
        temp: inference_parameters.temp,
    };

    let result = state.0.lock().unwrap().inference_with_prompt(
        &params,
        message,
        NUM_PREDICT,
        app_handle,
    );
    match result {
        Ok(_) => Ok(()),
        Err(llama_rs::InferenceError::ContextFull) => Ok(()),
        Err(llama_rs::InferenceError::UserCallback(_)) => unreachable!("cannot fail"),
    }
}

fn main() {
    env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .parse_default_env()
        .init();

    tauri::Builder::default()
        .manage(LlamaState(Mutex::new(Llama {
            model: None,
            session: None,
            rng: None,
            vocab: None,
        })))
        .invoke_handler(tauri::generate_handler![load_model, send_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
