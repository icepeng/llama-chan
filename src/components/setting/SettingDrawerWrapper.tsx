import { PropsWithChildren } from "react";

export const SETTING_DRAWER_ID = "setting-drawer";

export interface InferenceParameters {
  n_batch: number | string;
  top_k: number | string;
  top_p: number | string;
  repeat_penalty: number | string;
  temp: number | string;
}

interface SettingDrawerWrapperProps extends PropsWithChildren<{}> {
  inferenceParameters: InferenceParameters;
  setInferenceParameters: React.Dispatch<React.SetStateAction<InferenceParameters>>;
}

interface InferenceParametersOption {
  min: number;
  max: number;
  step: number;
}

const inferenceParametersOptions: Record<keyof InferenceParameters, InferenceParametersOption> = {
  n_batch: { min: 1, max: 100, step: 1 },
  top_k: { min: 1, max: 100, step: 1 },
  top_p: { min: 0, max: 1, step: 0.01 },
  repeat_penalty: { min: 0, max: 5, step: 0.01 },
  temp: { min: 0, max: 1, step: 0.01 },
} as const;

const SettingDrawerWrapper = (props: SettingDrawerWrapperProps) => {
  return (
    <div className="drawer drawer-end">
      <input id={SETTING_DRAWER_ID} type="checkbox" className="drawer-toggle" />
      <div className="drawer-content">{props.children}</div>
      <div className="drawer-side">
        <label htmlFor={SETTING_DRAWER_ID} className="drawer-overlay"></label>
        <div className="flex flex-nowrap max-h-full overflow-x-auto gap-5 menu p-4 w-80 bg-base-100 text-base-content">
          {Object.entries(props.inferenceParameters).map(([key, value]) => (
            <div key={key}>
              <span className="label-text">{key}</span>
              <input
                type="text"
                className="input input-bordered input-xs w-full"
                value={value}
                onChange={({ target: { value } }) => {
                  props.setInferenceParameters((oldInferenceParameters) => ({
                    ...oldInferenceParameters,
                    [key]: value,
                  }));
                }}
              />
              <div className="h-2" />
              <input
                type="range"
                {...inferenceParametersOptions[key as keyof InferenceParameters]}
                value={value}
                className="range input-xs"
                onChange={({ target: { value } }) => {
                  props.setInferenceParameters((oldInferenceParameters) => ({
                    ...oldInferenceParameters,
                    [key]: value,
                  }));
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingDrawerWrapper;
