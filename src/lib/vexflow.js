import Vex from 'vexflow';

const noteHeadTypeLookup = {
  drumset: {
    E5: "x2",
  },
};

const VF = Vex.Flow;
const SPACE_BETWEEN_GRAND_STAVES = 222;
const PADDING_TOP = 50;

export function drawScore(score, windowWidth) {
    
    // Create an SVG renderer and attach it to the DIV element named "vf".
    const renderer = new VF.Renderer(
      document.getElementById("vexflow"),
      VF.Renderer.Backends.SVG
    );
    // Configure the rendering context.

    const context = renderer.getContext();
    context.setFont("Arial", 10, "").setBackgroundFillStyle("#eed");

    let { measures } = score;
    const { tempo } = score;
    const spb = 60 / tempo;
    context.clear();
    let systemWidth = 0;

    measures = measures.concat(measures).concat(measures);

    const {loopTimeDuration, measurePartsArray, toneJsNotes} = getMeasureData(measures, spb);

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
        Math.max(formatter.preCalculateMinTotalWidth(voices.flat()), 100)
      );

      systemWidth = minTotalWidth + 13;

      if (width + systemWidth > windowWidth) {
        renderStaves(barRenderData, windowWidth - width, row, context);
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
      renderStaves(barRenderData, 0, row, context);
    }

    renderer.resize(windowWidth, SPACE_BETWEEN_GRAND_STAVES * (row + 1));

    return { toneJsNotes, loopTimeDuration };
  }

  function getMeasureData(measures, spb)
  {
    const measurePartsArray = [];
    let toneJsNotes = [];
    let measureStartingTime = 0;
    let measureTimeLength = 0;
    let loopTimeDuration = 0;
    for (const measure of measures) {
      loopTimeDuration += measure.timeSig.num * spb;

      measureStartingTime += measureTimeLength;
      measureTimeLength = 0;
      const { parts } = measure;
      let measureParts = [];
      let firstPart = true;
      for (const part of parts) {
        let partData = {
          voices: [],
          beams: [],
        };

        const { voices, instrument } = part;
        let time = measureStartingTime;

        let vfVoices = [];
        let vfVoiceBeams = [];
        for (const voice of voices) {
          const { notes } = voice;
          var vfNotes = [];
          for (const note of notes) {
            const noteSecondsDuration = (spb * 4) / note.duration;

            for (const tjsNote of note.notes) {
              toneJsNotes.push({
                time: time,
                note: tjsNote,
                velocity: 1,
                instrument,
              });
            }

            vfNotes.push(getNote(note, instrument));
            time += noteSecondsDuration;

            if (firstPart) {
              measureTimeLength += noteSecondsDuration;
            }
          }

          // Create a voice in 4/4 and add the notes from above
          var vfVoice = new VF.Voice({ num_beats: 4, beat_value: 4 });
          vfVoice.addTickables(vfNotes);
          vfVoices.push(vfVoice);
          vfVoiceBeams.push(
            VF.Beam.generateBeams(vfNotes, {
              stem_direction: Vex.Flow.StaveNote.STEM_UP,
            })
          );
        }

        partData.voices.push(vfVoices);
        partData.beams.push(vfVoiceBeams);
        measureParts.push({
          voices: vfVoices,
          beams: vfVoiceBeams,
          instrument,
        });

        firstPart = false;
      }

      measurePartsArray.push(measureParts);
    }

    return {measurePartsArray, loopTimeDuration, toneJsNotes};
  }

  function getNote(note, instrument) {
    return new VF.StaveNote({
      clef: "percussion",
      keys: note.notes.map((n) => {
        const noteHead =
          noteHeadTypeLookup[instrument] != null
            ? noteHeadTypeLookup[instrument][n] != null
              ? "/" + noteHeadTypeLookup[instrument][n]
              : ""
            : "";

        return `${n[0]}/${n[1]}${noteHead}`;
      }),
      duration: note.duration,
    });
  }

  function renderStaves(barRenderData, remainingWidth, row, context) {
    const barWidths = barRenderData.map((renderDataBar) => renderDataBar.width);

    //Given the space left over in the stave (i.e.: remainingWidth), get the additional
    //width to add to each bar to make up that space.
    const additionalWidths = getAdditionalWidthsForBars(
      barWidths,
      remainingWidth
    );

    let x = row === 0 ? 100 : 0;

    barRenderData.forEach((renderData, i) => {
      const { parts, width, firstMeasure } = renderData;

      let xDiff = 0;

      parts.forEach((part, partIndex) => {
        let systemWidth = width + additionalWidths[i];
        const stave = new VF.Stave(
          x,
          (partIndex * 100) + (row * SPACE_BETWEEN_GRAND_STAVES),
          systemWidth
        );

        const { voices, beams, instrument } = part;
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

        formatter.format(voices, systemWidth - widthDiff - 13);

        xDiff = systemWidth;

        voices.map((vfVoice) => vfVoice.draw(context, stave));
        beams.map((vfBeams) =>
          vfBeams.map((beam) => beam.setContext(context).draw())
        );
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