import Vex from "vexflow";
import VexFlowInteraction from "./VexFlowInteraction";
import { getNote, getGraceNote } from "../helpers/score";
import _ from "lodash";

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

  return { renderer, context };
}

export function drawScore(
  renderer,
  context,
  score,
  selectedNoteIndex,
  noteSelectedCallback,
  windowWidth,
  repeat
) {
  let { measures } = score;
  let systemWidth = 0;
  const measurePartsArray = getMeasureData(measures);

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
        selectedNoteIndex,
        noteSelectedCallback,
        repeat
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
      selectedNoteIndex,
      noteSelectedCallback,
      repeat
    );
  }
  renderer.resize(windowWidth, SPACE_BETWEEN_GRAND_STAVES * (row + 1));
  context.scale(0.75, 0.75);
}

function getMeasureData(measures) {
  const measurePartsArray = [];

  measures.forEach((measure, measureIndex) => {
    const { parts } = measure;
    let measureParts = [];
    parts.forEach((part, partIndex) => {
      let partData = {
        voices: [],
        beams: [],
      };

      const { voices, instrument } = part;

      let vfVoices = [];
      let vfVoiceBeams = [];
      let vfVoiceNotes = [];
      voices.forEach((voice, voiceIndex) => {
        const { notes } = voice;
        var vfNotes = [];
        notes.forEach((note, noteIndex) => {
          const n = getNote(
            VF.StaveNote.prototype.constructor,
            note,
            instrument
          );

          if (note.ornaments) {
            if (note.ornaments.includes("c")) {
              let tremolo = new VF.Tremolo(1);
              n.addArticulation(0, tremolo);

              n.addModifier(
                0,
                new VF.GraceNoteGroup([
                  getGraceNote(VF.GraceNote.prototype.constructor),
                ])
              );
            }

            //diddle - add tremolo
            if (note.ornaments.includes("d")) {
              let tremolo = new VF.Tremolo(1);
              n.addArticulation(0, tremolo);
            }

            //flam - add grace note
            if (note.ornaments.includes("f")) {
              n.addModifier(
                0,
                new VF.GraceNoteGroup([
                  getGraceNote(VF.GraceNote.prototype.constructor),
                ])
              );
            }

            //accent
            if (note.ornaments.includes("a")) {
              n.addArticulation(0, new VF.Articulation("a>").setPosition(3));
            }

            //right sticking - add 'R' annotation
            if (note.ornaments.includes("r")) {
              const annotation = new VF.Annotation("R");
              annotation.setVerticalJustification(
                VF.Annotation.VerticalJustify.BOTTOM
              );

              n.addModifier(0, annotation);
            } else if (note.ornaments.includes("l")) {
              //left sticking - add 'L' annotation
              const annotation = new VF.Annotation("L");
              annotation.setVerticalJustification(
                VF.Annotation.VerticalJustify.BOTTOM
              );

              n.addModifier(0, annotation);
            }
          }

          n.noteIndex = noteIndex;
          n.voiceIndex = voiceIndex;
          n.partIndex = partIndex;
          n.measureIndex = measureIndex;

          vfNotes.push(n);
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
    });

    measurePartsArray.push(measureParts);
  });

  return measurePartsArray;
}

function renderStaves(
  barRenderData,
  remainingWidth,
  row,
  context,
  selectedNoteIndex,
  noteSelectedCallback,
  repeat
) {
  const barWidths = barRenderData.map((renderDataBar) => renderDataBar.width);

  //Given the space left over in the stave (i.e.: remainingWidth), get the additional
  //width to add to each bar to make up that space.
  const additionalWidths = getAdditionalWidthsForBars(
    barWidths,
    remainingWidth
  );

  let x = 0;

  if (row === 0 && barRenderData[0].parts.length > 1) {
    x = 100;
  }

  barRenderData.forEach((renderData, measureIndex) => {
    const { parts, width, firstMeasure } = renderData;

    let xDiff = 0;

    parts.forEach((part, partIndex) => {
      let systemWidth = width + additionalWidths[measureIndex];
      const stave = new VF.Stave(
        x,
        partIndex * 100 + row * SPACE_BETWEEN_GRAND_STAVES,
        systemWidth,
        {
          space_above_staff_ln: 6,
        }
      );

      if (repeat.start === measureIndex) {
        stave.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
      }

      if (repeat.end === measureIndex) {
        stave.setEndBarType(VF.Barline.type.REPEAT_END);
      }

      const { voices, notes, beams, instrument } = part;
      var formatter = new VF.Formatter();

      let widthDiff = 0;
      if (firstMeasure) {
        // Add a clef and time signature.
        stave.addTimeSignature("4/4");

        //We don't need the measure label if it is the only instrument in the score.
        if (parts.length > 1) {
          stave.setText(instrument, Vex.Flow.Modifier.Position.LEFT);
        }

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
      
      notes[0].forEach((note, noteIndex) => {
        // highlight the note if it selected
        if (
          selectedNoteIndex &&
          note.measureIndex === selectedNoteIndex.measureIndex &&
          note.partIndex === selectedNoteIndex.partIndex &&
          note.voiceIndex === selectedNoteIndex.voiceIndex &&
          noteIndex === selectedNoteIndex.noteIndex
        ) {
          note.setStyle({ fillStyle: "#00FF00" });
          note.setContext(context).draw();
        }

        const noteInteraction = new VexFlowInteraction(
          note.attrs.el,
          interaction.svgPt
        );
        const events = ["touchStart"];
        events.forEach((type) => {
          noteInteraction.addEventListener(type, (e, coords) => {

            //Two events are fired on mobile. One with e.type === 'mousedown' and another with
            //e.type === 'touchStart'. Desktop only fires e.type === 'mousedown'. Since we only want 
            //this callback to fire once, we are calling out e.type === 'mousedown'.
            if (e.type === 'mousedown') {
              noteSelectedCallback(note, context);
            }
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
