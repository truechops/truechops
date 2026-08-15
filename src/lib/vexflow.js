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
} from "../consts/ornaments";

const VF = Vex.Flow;
const BASE_STAVE_SPACE = 125;
let STAVE_SPACE = BASE_STAVE_SPACE;
const PADDING = 50;
const FORMAT_PADDING = 13;
const MIN_BAR_SIZE = 100;
const SCORE_MIN_WIDTH = 100;
const TUPLET_Y_OFFSET = {
  DEFAULT: -4,
  WITH_ABOVE_ACCENT: 8,
};
const LONGEST_UNBEAMED_TUPLET_DURATION = 4;

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
  const {
    width: svgWidthProposed,
    scale,
    hResize,
    vResize,
    justifyLastRow,
    measureNotePadding = 0,
    measureNoteStartPadding,
    measureNoteEndPadding,
    maxMeasureWidth,
    hideTimeSignature = false,
  } = svgConfig;
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
    const naturalBarWidth = systemWidth + (firstMeasure ? 20 : 0);
    const configuredMaxMeasureWidth = Number(maxMeasureWidth);
    const barWidth = Number.isFinite(configuredMaxMeasureWidth) && configuredMaxMeasureWidth > 0
      ? Math.min(naturalBarWidth, configuredMaxMeasureWidth)
      : naturalBarWidth;

    if ((width + barWidth > svgWidth + PADDING) && barRenderData.length) {
      renderStaves(
        barRenderData,
        systemWidth - PADDING,
        row,
        context,
        selectedNoteIndex,
        noteSelectedCallback,
        repeat,
        previousTimeSig,
        measureNoteStartPadding,
        measureNoteEndPadding,
        hideTimeSignature
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
      width: barWidth,
      firstMeasure,
      measureIndex,
      timeSig: score.measures[measureIndex].timeSig,
    });

    width += barWidth;
    firstMeasure = false;
    measureIndex++;
  }

  if (barRenderData.length) {
    const remainingWidth = justifyLastRow ? Math.max(svgWidth - width, 0) : 0;

    renderStaves(
      barRenderData,
      remainingWidth,
      row,
      context,
      selectedNoteIndex,
      noteSelectedCallback,
      repeat,
      previousTimeSig,
      measureNoteStartPadding,
      measureNoteEndPadding,
      hideTimeSignature
    );

    if(width + remainingWidth > maxWidth) {
      maxWidth = width + remainingWidth
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

        const voiceTuplets = Array.isArray(tuplets) ? tuplets : [];

        voiceTuplets.forEach((tuplet) => {
          const tupletNotes = notes.slice(tuplet.start, tuplet.end);
          vfTuplets.push(
            new VF.Tuplet(vfNotes.slice(tuplet.start, tuplet.end), {
              num_notes: tuplet.actual,
              notes_occupied: tuplet.normal,
              bracketed: false,
              y_offset: getTupletYOffset(tupletNotes, instrument),
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
        const generatedBeams = getVoiceBeams(vfNotes, notes, voiceTuplets, timeSig);
        vfTuplets.forEach((vfTuplet) => vfTuplet.setBracketed(false));
        vfVoiceBeams.push(generatedBeams);
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
  previousTimeSig,
  measureNoteStartPadding,
  measureNoteEndPadding,
  hideTimeSignature
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
      if (!hideTimeSignature && !_.isEqual(previousTimeSig, timeSig)) {
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

      if (measureNoteStartPadding) {
        stave.setNoteStartX(stave.getNoteStartX() + measureNoteStartPadding);
        widthDiff = stave.getNoteStartX() - stave.getX();
      }

      stave.setContext(context).draw();

      formatter.format(
        voices,
        systemWidth - widthDiff - FORMAT_PADDING - measureNoteEndPadding
      );

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
        if (noteSelectedCallback) {
          const noteSvg = note.getSVGElement()
          const noteInteraction = new VexFlowInteraction(
            noteSvg,
            context.svg.createSVGPoint()
          );
          const events = ["touchStart"];
          events.forEach((type) => {
            noteInteraction.addEventListener(type, (e) => {
              //Two events are fired on mobile. One with e.type === 'mousedown' and another with
              //e.type === 'touchStart'. Desktop only fires e.type === 'mousedown'. Since we only want
              //this callback to fire once, we are calling out e.type === 'mousedown'.
              if (e.type === "mousedown") {
                noteSelectedCallback(note, context);
              }
            });
          });
        }
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

function createAutomaticBeams(vfNotes, timeSig) {
  if (vfNotes.length < 2) {
    return [];
  }

  return VF.Beam.generateBeams(vfNotes, {
    stem_direction: Vex.Flow.StaveNote.STEM_UP,
    groups: timeSigs[`${timeSig.num}/${timeSig.type}`].groups.map(group =>
      new Vex.Flow.Fraction(group[0], group[1]))
  });
}

function hasQuarterOrLongerDuration(jsonNote) {
  return Number(jsonNote?.duration) <= LONGEST_UNBEAMED_TUPLET_DURATION;
}

function isJsonRest(jsonNote) {
  return !Array.isArray(jsonNote?.notes) || jsonNote.notes.length === 0;
}

function shouldBeamTupletAsSingleGroup(jsonNotes) {
  const playedNoteCount = jsonNotes.filter((note) => !isJsonRest(note)).length;

  return playedNoteCount > 1 &&
    jsonNotes.length > 1 &&
    !jsonNotes.some(hasQuarterOrLongerDuration);
}

function getTupletBeamStartIndex(jsonNotes) {
  let startIndex = 0;

  while (startIndex < jsonNotes.length && isJsonRest(jsonNotes[startIndex])) {
    startIndex += 1;
  }

  return startIndex;
}

function createTupletBeams(vfNotes, jsonNotes) {
  const beamStartIndex = getTupletBeamStartIndex(jsonNotes);
  const beamVfNotes = vfNotes.slice(beamStartIndex);
  const beamJsonNotes = jsonNotes.slice(beamStartIndex);

  if (!shouldBeamTupletAsSingleGroup(beamJsonNotes)) {
    return [];
  }

  return VF.Beam.generateBeams(beamVfNotes, {
    beam_rests: true,
    show_stemlets: false,
    stem_direction: Vex.Flow.StaveNote.STEM_UP,
    groups: [new Vex.Flow.Fraction(1, 1)],
  });
}

function getVoiceBeams(vfNotes, jsonNotes, tuplets, timeSig) {
  const forcedTupletRanges = [];
  const tupletBeams = [];

  tuplets
    .map((tuplet) => ({
      end: Math.min(Number(tuplet.end), vfNotes.length),
      start: Math.max(0, Number(tuplet.start)),
    }))
    .filter((tuplet) => Number.isInteger(tuplet.start) &&
      Number.isInteger(tuplet.end) &&
      tuplet.end > tuplet.start)
    .sort((left, right) => left.start - right.start)
    .forEach((tuplet) => {
      const tupletJsonNotes = jsonNotes.slice(tuplet.start, tuplet.end);

      const tupletVfNotes = vfNotes.slice(tuplet.start, tuplet.end);
      const generatedTupletBeams = createTupletBeams(tupletVfNotes, tupletJsonNotes);

      if (!generatedTupletBeams.length) {
        return;
      }

      forcedTupletRanges.push(tuplet);
      tupletBeams.push(...generatedTupletBeams);
    });

  if (!forcedTupletRanges.length) {
    return createAutomaticBeams(vfNotes, timeSig);
  }

  const automaticBeams = [];
  let cursor = 0;

  forcedTupletRanges.forEach((tuplet) => {
    if (tuplet.start > cursor) {
      automaticBeams.push(...createAutomaticBeams(vfNotes.slice(cursor, tuplet.start), timeSig));
    }

    cursor = Math.max(cursor, tuplet.end);
  });

  if (cursor < vfNotes.length) {
    automaticBeams.push(...createAutomaticBeams(vfNotes.slice(cursor), timeSig));
  }

  return [...automaticBeams, ...tupletBeams];
}

function hasAboveStaffAccent(jsonNote, instrument) {
  const ornaments = String(jsonNote?.ornaments || "");

  return ornaments.includes(ACCENT) ||
    (instrument === "snare" && jsonNote?.notes?.includes("E5"));
}

function getTupletYOffset(notes, instrument) {
  return notes.some((note) => hasAboveStaffAccent(note, instrument))
    ? TUPLET_Y_OFFSET.WITH_ABOVE_ACCENT
    : TUPLET_Y_OFFSET.DEFAULT;
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
