import Vex from "vexflow";
import VexFlowInteraction from "./VexFlowInteraction";
import { getNote } from "../helpers/score";
import { GiConsoleController } from "react-icons/gi";

const VF = Vex.Flow;
const SPACE_BETWEEN_GRAND_STAVES = 222;
const PADDING_TOP = 50;
const FORMAT_PADDING = 13;
const MIN_BAR_SIZE = 225;

export function initialize() {
  // Create an SVG renderer and attach it to the DIV element named "vf".
  const renderer = new VF.Renderer(
    document.getElementById("vexflow"),
    VF.Renderer.Backends.SVG
  );
  // Configure the rendering context.

  const context = renderer.getContext();
  context.setFont("Arial", 10, "").setBackgroundFillStyle("#eed");

  return {renderer, context};
}

export function drawScore(
  renderer,
  context,
  score,
  selectedNote,
  noteSelectedCallback,
  windowWidth
) {
  let { measures } = score;
  const { tempo } = score;
  const spb = 60 / tempo;
  context.clear();
  let systemWidth = 0;
  const { loopTimeDuration, measurePartsArray, toneJsNotes } = getMeasureData(
    measures,
    spb
  );

  let barRenderData = [];
  let width = 100;
  let row = 0;
  let firstMeasure = true;
  for (const measureParts of measurePartsArray) {
    let voices = measureParts.map((measurePart) => measurePart.voices);
    //One formatter for both parts so that we can calculate one width to
    //keep all the parts aligned.
    var formatter = new VF.Formatter();
    voices.map((v) => formatter.joinVoices(v));

    let minTotalWidth = Math.ceil(
      Math.max(formatter.preCalculateMinTotalWidth(voices.flat()), MIN_BAR_SIZE)
    );

    systemWidth = minTotalWidth + FORMAT_PADDING;

    if (width + systemWidth > windowWidth) {
      renderStaves(
        barRenderData,
        windowWidth - width,
        row,
        context,
        selectedNote,
        noteSelectedCallback
      );
      barRenderData = [];
      width = 0;
      row += 1;
    }

    barRenderData.push({
      parts: measureParts,
      width: systemWidth + (firstMeasure ? 20 : 0),
      firstMeasure,
    });

    width += systemWidth + (firstMeasure ? 20 : 0);
    firstMeasure = false;
  }

  if (barRenderData.length) {
    renderStaves(
      barRenderData,
      0,
      row,
      context,
      selectedNote,
      noteSelectedCallback
    );
  }

  renderer.resize(windowWidth, SPACE_BETWEEN_GRAND_STAVES * (row + 1));

  return { toneJsNotes, loopTimeDuration };
}

function getMeasureData(measures, spb) {
  const measurePartsArray = [];
  let toneJsNotes = [];
  let measureStartingTime = 0;
  let measureTimeLength = 0;
  let loopTimeDuration = 0;
  measures.forEach((measure, measureIndex) => {
    loopTimeDuration += measure.timeSig.num * spb;

    measureStartingTime += measureTimeLength;
    measureTimeLength = 0;
    const { parts } = measure;
    let measureParts = [];
    let firstPart = true;
    parts.forEach((part, partIndex) => {
      let partData = {
        voices: [],
        beams: [],
      };

      const { voices, instrument } = part;
      let time = measureStartingTime;

      let vfVoices = [];
      let vfVoiceBeams = [];
      let vfVoiceNotes = [];
      voices.forEach((voice, voiceIndex) => {
        const { notes } = voice;
        var vfNotes = [];
        notes.forEach((note, noteIndex) => {
          const noteSecondsDuration = (spb * 4) / note.duration;

          if(note.notes.length) {
            for (const tjsNote of note.notes) {
              toneJsNotes.push({
                time,
                note: tjsNote,
                velocity: 1,
                instrument,
              });
            }
          } else {
            toneJsNotes.push({});
          }

          const n = getNote(
            VF.StaveNote.prototype.constructor,
            note,
            instrument
          );
          n.noteIndex = noteIndex;
          n.voiceIndex = voiceIndex;
          n.partIndex = partIndex;
          n.measureIndex = measureIndex;

          vfNotes.push(n);
          time += noteSecondsDuration;

          if (firstPart) {
            measureTimeLength += noteSecondsDuration;
          }
        });

        // Create a voice in 4/4 and add the notes from above
        var vfVoice = new VF.Voice({ num_beats: 4, beat_value: 4 });
        vfVoice.addTickables(vfNotes);
        vfVoices.push(vfVoice);
        vfVoiceBeams.push(
          VF.Beam.generateBeams(vfNotes, {
            stem_direction: Vex.Flow.StaveNote.STEM_UP,
          })
        );
        vfVoiceNotes.push(vfNotes);
      });

      partData.voices.push(vfVoices);
      partData.beams.push(vfVoiceBeams);
      measureParts.push({
        voices: vfVoices,
        notes: vfVoiceNotes,
        beams: vfVoiceBeams,
        instrument,
      });

      firstPart = false;
    });

    measurePartsArray.push(measureParts);
  });

  return { measurePartsArray, loopTimeDuration, toneJsNotes };
}

function renderStaves(
  barRenderData,
  remainingWidth,
  row,
  context,
  selectedNote,
  noteSelectedCallback
) {
  const barWidths = barRenderData.map((renderDataBar) => renderDataBar.width);

  //Given the space left over in the stave (i.e.: remainingWidth), get the additional
  //width to add to each bar to make up that space.
  const additionalWidths = getAdditionalWidthsForBars(
    barWidths,
    remainingWidth
  );

  let x = row === 0 ? 100 : 0;

  barRenderData.forEach((renderData, measureIndex) => {
    const { parts, width, firstMeasure } = renderData;

    let xDiff = 0;

    parts.forEach((part, partIndex) => {
      let systemWidth = width + additionalWidths[measureIndex];
      const stave = new VF.Stave(
        x,
        partIndex * 100 + row * SPACE_BETWEEN_GRAND_STAVES,
        systemWidth
      );

      const { voices, notes, beams, instrument } = part;
      var formatter = new VF.Formatter();

      let widthDiff = 0;
      if (firstMeasure) {
        // Add a clef and time signature.
        stave.addTimeSignature("4/4");
        stave.setText(instrument, Vex.Flow.Modifier.Position.LEFT);
        widthDiff = stave.getNoteStartX() - stave.getX();
      }

      stave.setWidth(systemWidth);
      stave.setContext(context).draw();

      formatter.format(voices, systemWidth - widthDiff - FORMAT_PADDING);

      xDiff = systemWidth;

      voices.map((vfVoice) => vfVoice.draw(context, stave));
      beams.map((vfBeams) =>
        vfBeams.map((beam) => beam.setContext(context).draw())
      );
      const interaction = new VexFlowInteraction(context.svg);
      const events = ["touchStart", "touchEnd"];
      notes[0].forEach((note, noteIndex) => {
        // highlight the note if it selected
        if (selectedNote && 
          note.measureIndex === selectedNote.measureIndex &&
          note.partIndex === selectedNote.partIndex &&
          note.voiceIndex === selectedNote.voiceIndex &&
          noteIndex === selectedNote.noteIndex
        ) {
          note.setStyle({ fillStyle: "#00FF00" });
          note.setContext(context).draw();
        }

        const noteInteraction = new VexFlowInteraction(
          note.attrs.el,
          interaction.svgPt
        );
        events.forEach((type) => {
          noteInteraction.addEventListener(type, (e, coords) => {
            noteSelectedCallback(note, context);
          });
        });
      });
    });

    x += xDiff;
  });
}

function getAdditionalWidthsForBars(widths, remainingWidth) {
  const reducer = (sum, value) => sum + value;
  const totalWidth = widths.reduce(reducer, 0);
  const percentages = widths.map((width) => width / totalWidth);
  return percentages.map((percentage) => percentage * remainingWidth);
}
