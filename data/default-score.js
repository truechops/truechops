import { NON_ACCENT_VELOCITY } from "./score";

export default {
  tempo: 95.0,
  parts: {
    drumset: {
      enabled: true
    }
  },
  measures: [
    {
      timeSig: {
        num: 4,
        type: 4,
      },
      parts: [
        {
          instrument: 'drumset',
          voices: [
            {
              notes: [
                {
                  notes: [],
                  duration: 4,
                  velocity: NON_ACCENT_VELOCITY,
                },
                {
                  notes: [],
                  duration: 4,
                  velocity: NON_ACCENT_VELOCITY,
                },
                {
                  notes: [],
                  duration: 4,
                  velocity: NON_ACCENT_VELOCITY,
                },
                {
                  notes: [],
                  duration: 4,
                  velocity: NON_ACCENT_VELOCITY,
                },
              ],
            },
          ],
          tuplets: [],
        },
      ],
    },
  ],
};
