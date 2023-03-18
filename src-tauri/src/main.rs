// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use llama_rs::{InferenceParameters, InferenceSnapshot};
use rand::SeedableRng;
use std::{convert::Infallible, io::Write};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(model_path: &str) -> String {
    let inference_params = InferenceParameters {
        n_threads: num_cpus::get_physical() as i32,
        n_batch: 8,
        top_k: 40,
        top_p: 1.0,
        repeat_penalty: 1.18,
        temp: 0.7,
        // n_threads: args.num_threads as i32,
        // n_batch: args.batch_size,
        // top_k: args.top_k,
        // top_p: args.top_p,
        // repeat_penalty: args.repeat_penalty,
        // temp: args.temp,
    };

    let num_ctx_tokens = 512;
    let num_predict: Option<usize> = None;
    let repeat_last_n = 64;
    let prompt = "Hello, world!";

    let (mut model, vocab) =
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

    log::info!("Model fully loaded!");

    let mut rng = rand::rngs::StdRng::from_entropy();

    let mut session = model.start_session(repeat_last_n);

    let res = session.inference_with_prompt::<Infallible>(
        &model,
        &vocab,
        &inference_params,
        &prompt,
        num_predict,
        &mut rng,
        |t| {
            print!("{t}");
            std::io::stdout().flush().unwrap();

            Ok(())
        },
    );
    println!();

    match res {
        Ok(_) => (),
        Err(llama_rs::InferenceError::ContextFull) => {
            log::warn!("Context window full, stopping inference.")
        }
        Err(llama_rs::InferenceError::UserCallback(_)) => unreachable!("cannot fail"),
    }

    format!("Hello?")
}

fn main() {
    env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .parse_default_env()
        .init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
