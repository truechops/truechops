import { createSlice } from '@reduxjs/toolkit';
import defaultScore from '../components/compose/sample-score';

const initialState = {
    selectedNote: {
        measureIndex: 0,
        partIndex: 0,
        voiceIndex: 0,
        noteIndex: 0
    },
    score: defaultScore
}

const scoreSlice = createSlice({
    name: 'score',
    initialState,
    reducers: {
        selectNote(state, action) {
            const { measureIndex, partIndex, voiceIndex, noteIndex } = action.payload;
            state.selectedNote.measureIndex = measureIndex;
            state.selectedNote.partIndex = partIndex;
            state.selectedNote.voiceIndex = voiceIndex;
            state.selectedNote.noteIndex = noteIndex;
        },

        //When user modifies a note in the score. Ex: 8th note to 16th note
        modifyNote(state, action) {
            const noteValue = action.payload;
            const { measureIndex, partIndex, voiceIndex, noteIndex } = state.selectedNote;
            console.log(JSON.stringify(state.score));
            let notes = state.score.measures[measureIndex].parts[partIndex].voices[voiceIndex].notes;
            
            const note = notes[noteIndex];
            note.duration = 16;
            notes.splice(noteIndex, 1, note, note);
        }
    }
});

export default scoreSlice.reducer;
export const scoreActions = scoreSlice.actions;