import {Vex, Dot} from "vexflow";
import VexFlowInteraction from "./VexFlowInteraction";
import { getNote, getGraceNote } from "../helpers/score";
import { NOTE_HIGHLIGHT_COLOR, timeSigs } from "../consts/score";
import _ from "lodash";
import {
  ACCENT,
  FLAM,
  DIDDLE,
  CHEESE,
  BUZZ,
  LEFT_STICKING,
  RIGHT_STICKING,
} from "../store/score";

const VF = Vex.Flow;
const BASE_STAVE_SPACE = 125;
let STAVE_SPACE = BASE_STAVE_SPACE;
const PADDING = 50;
const FORMAT_PADDING = 13;
const MIN_BAR_SIZE = 100;
const SCORE_MIN_WIDTH = 100;

export function initialize(id) {
  // Create an SVG renderer and attach it to the DIV element named "vf".
  const renderer = new VF.Renderer(
    document.getElementById(id),
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
  svgConfig,
  repeat,
) {
  const {width: svgWidthProposed, scale, hResize, vResize} = svgConfig;
  let { measures } = score;
  let systemWidth = 0;
  const measurePartsArray = getMeasureData(measures, score.parts);
  let measureIndex = 0;
  STAVE_SPACE = BASE_STAVE_SPACE * measurePartsArray[0].length;
  const svgWidth = Math.max(svgWidthProposed, SCORE_MIN_WIDTH);

  let barRenderData = [];
  let width = measurePartsArray[0].length > 1 ? 100 : 0;
  let row = 0;
  let firstMeasure = true;
  let previousTimeSig = {};
  let maxWidth = 0;
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

    if ((width + systemWidth > svgWidth + PADDING) && barRenderData.length) {
      renderStaves(
        barRenderData,
        systemWidth - PADDING,
        row,
        context,
        selectedNoteIndex,
        noteSelectedCallback,
        repeat,
        previousTimeSig
      );

      if(width + systemWidth > maxWidth) {
        maxWidth = width + systemWidth
      }

      barRenderData = [];
      width = 0;
      row += 1;
    }

    barRenderData.push({
      parts: measureParts,
      width: systemWidth + (firstMeasure ? 20 : 0),
      firstMeasure,
      measureIndex,
      timeSig: score.measures[measureIndex].timeSig,
    });

    width += systemWidth + (firstMeasure ? 20 : 0);
    firstMeasure = false;
    measureIndex++;
  }

  if (barRenderData.length) {
    renderStaves(
      barRenderData,
      0,
      row,
      context,
      selectedNoteIndex,
      noteSelectedCallback,
      repeat,
      previousTimeSig
    );

    if(width > maxWidth) {
      maxWidth = width
    }
  }

  renderer.resize(
    (maxWidth + PADDING) * (hResize ?? 1),
    (STAVE_SPACE * (row + 1)) * (vResize ?? 1) /** scale * scaleWidthMultipler*/
  );

  context.scale(scale, scale);
}

function getMeasureData(measures, partConfig) {
  const measurePartsArray = [];

  measures.forEach((measure, measureIndex) => {
    let { parts, timeSig } = measure;

    //Only render instruments that are enabled.
    parts = parts.filter((part) => partConfig[part.instrument].enabled);
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
      let vfTuplets = [];
      voices.forEach((voice, voiceIndex) => {
        const { notes, tuplets } = voice;
        var vfNotes = [];
        notes.forEach((note, noteIndex) => {
          const n = getNote(
            VF.StaveNote.prototype.constructor,
            note,
            instrument
          );

          const numDots = note.dots != null ? note.dots : 0;
          for (var i = 0; i < numDots; i++) {
            const dot = new Dot();
            n.addModifier(dot, i);
          }

          addOrnaments(note, n, instrument);

          n.noteIndex = noteIndex;
          n.voiceIndex = voiceIndex;
          n.partIndex = partIndex;
          n.measureIndex = measureIndex;

          vfNotes.push(n);
        });

        tuplets.forEach((tuplet) => {
          vfTuplets.push(
            new VF.Tuplet(vfNotes.slice(tuplet.start, tuplet.end), {
              num_notes: tuplet.actual,
              notes_occupied: tuplet.normal,
              bracketed: true,
            })
          );
        });

        // Create a voice in 4/4 and add the notes from above
        var vfVoice = new VF.Voice({
          num_beats: timeSig.num,
          beat_value: timeSig.type,
        });
        vfVoice.addTickables(vfNotes);
        vfVoices.push(vfVoice);
        vfVoiceBeams.push(
          VF.Beam.generateBeams(vfNotes, {
            stem_direction: Vex.Flow.StaveNote.STEM_UP,
            groups: timeSigs[`${timeSig.num}/${timeSig.type}`].groups.map(group => 
              new Vex.Flow.Fraction(group[0], group[1]))
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
        tuplets: vfTuplets,
        instrument,
      });
    });

    measurePartsArray.push(measureParts);
  });

  return measurePartsArray;
}

//Render the staves onto the score.
function renderStaves(
  barRenderData,
  remainingWidth,
  row,
  context,
  selectedNoteIndex,
  noteSelectedCallback,
  repeat,
  previousTimeSig
) {

  const barWidths = barRenderData.map((renderDataBar) => renderDataBar.width);
  //Given the space left over in the stave (i.e.: remainingWidth), get the additional
  //width to add to each bar to make up that space.
  const additionalWidths = getAdditionalWidthsForBars(
    barWidths,
    remainingWidth
  );

  let x = PADDING / 2;
  const numParts = barRenderData[0].parts.length;

  if (row === 0 && numParts > 1) {
    x += 100;
  }

  let staves = [];
  barRenderData.forEach((renderData, renderDataIndex) => {
    const { parts, width, firstMeasure, measureIndex, timeSig } = renderData;
    let xDiff = 0;

    parts.forEach((part, partIndex) => {
      let systemWidth = (width + additionalWidths[renderDataIndex]);
      const stave = new VF.Stave(
        x,
        partIndex * BASE_STAVE_SPACE + row * STAVE_SPACE,
        systemWidth,
        {
          space_above_staff_ln: 6,
        }
      );

      if (renderDataIndex === 0) {
        staves.push(stave);
      }

      if (repeat.start === measureIndex) {
        stave.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
      }

      if (repeat.end === measureIndex) {
        stave.setEndBarType(VF.Barline.type.REPEAT_END);
      }

      const { voices, notes, beams, instrument, tuplets } = part;
      var formatter = new VF.Formatter();

      let widthDiff = 0;
      if (!_.isEqual(previousTimeSig, timeSig)) {
        stave.addTimeSignature(`${timeSig.num}/${timeSig.type}`);
        widthDiff = stave.getNoteStartX() - stave.getX();
      }

      if (firstMeasure) {
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

      tuplets.map((vfTuplet) => vfTuplet.setContext(context).draw());
      
      notes[0].forEach((note, noteIndex) => {
        // highlight the note if it selected
        if (
          selectedNoteIndex &&
          note.measureIndex === selectedNoteIndex.measureIndex &&
          note.partIndex === selectedNoteIndex.partIndex &&
          note.voiceIndex === selectedNoteIndex.voiceIndex &&
          noteIndex === selectedNoteIndex.noteIndex
        ) {
          note.getSVGElement().setAttribute('fill', NOTE_HIGHLIGHT_COLOR)
        }
        const noteSvg = note.getSVGElement()
        const noteInteraction = new VexFlowInteraction(
          noteSvg,
          context.svg.createSVGPoint()
        );
        const events = ["touchStart"];
        events.forEach((type) => {
          noteInteraction.addEventListener(type, (e, coords) => {
            //Two events are fired on mobile. One with e.type === 'mousedown' and another with
            //e.type === 'touchStart'. Desktop only fires e.type === 'mousedown'. Since we only want
            //this callback to fire once, we are calling out e.type === 'mousedown'.
            if (e.type === "mousedown") {
              noteSelectedCallback(note, context);
            }
          });
        });
      });
    });

    previousTimeSig.num = timeSig.num;
    previousTimeSig.type = timeSig.type;
    x += xDiff;
  });

  if (numParts > 1) {
    var connector = new VF.StaveConnector(staves[0], staves[staves.length - 1]);
    connector.setType(VF.StaveConnector.type.SINGLE);
    connector.setContext(context);
    connector.draw();
  }
}

function getAdditionalWidthsForBars(widths, remainingWidth) {
  const reducer = (sum, value) => sum + value;
  const totalWidth = widths.reduce(reducer, 0);
  const percentages = widths.map((width) => width / totalWidth);
  return percentages.map((percentage) => percentage * remainingWidth);
}

function addOrnaments(jsonNote, scoreNote, instrument) {
  if (jsonNote.ornaments) {
    if (jsonNote.ornaments.includes(CHEESE)) {
      scoreNote.addModifier(new VF.Tremolo(1), 0);

      scoreNote.addModifier(
        new VF.GraceNoteGroup([
          getGraceNote(VF.GraceNote.prototype.constructor),
        ]), 0
      );
    }

    //diddle - add tremolo
    if (jsonNote.ornaments.includes(DIDDLE)) {
      scoreNote.addModifier(new VF.Tremolo(1), 0);
    } else if (jsonNote.ornaments.includes(BUZZ)) {
      scoreNote.addModifier(new VF.Tremolo(3), 0);
    }

    //flam - add grace note
    if (jsonNote.ornaments.includes(FLAM)) {
      scoreNote.addModifier(
        new VF.GraceNoteGroup([
          getGraceNote(VF.GraceNote.prototype.constructor),
        ]) ,0
      );
    }

    if(jsonNote.notes.indexOf('E5') >= 0 && instrument == 'snare') {
      scoreNote.addModifier(new VF.Articulation("a^").setPosition(3), 0);
    } else if (jsonNote.ornaments.includes(ACCENT)) {
      scoreNote.addModifier(new VF.Articulation("a>").setPosition(3), 0);
    }

    //right sticking - add 'R' annotation
    if (jsonNote.ornaments.includes(RIGHT_STICKING)) {
      const annotation = new VF.Annotation("R");
      annotation.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);

      scoreNote.addModifier(annotation, 0);
    } else if (jsonNote.ornaments.includes(LEFT_STICKING)) {
      //left sticking - add 'L' annotation
      const annotation = new VF.Annotation("L");
      annotation.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);

      scoreNote.addModifier(annotation, 0);
    }
  }
}
