import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../store/score';

export default function useOrnamentsFns() 
{
    const selectedNote = useSelector(state => state.scoreAux.selectedNote);
    const dispatch = useDispatch();
    
    return {
        toggleAccent: toggleAccent.bind(null, dispatch, selectedNote),
        toggleFlam: toggleFlam.bind(null, dispatch, selectedNote),
        toggleDiddle: toggleDiddle.bind(null, dispatch, selectedNote),
        toggleCheese: toggleCheese.bind(null, dispatch, selectedNote),
        toggleLeftSticking: toggleLeftSticking.bind(null, dispatch, selectedNote),
        toggleRightSticking: toggleRightSticking.bind(null, dispatch, selectedNote)
    }
}

function toggleAccent(dispatch, selectedNote) {
    dispatch(scoreActions.toggleAccent(selectedNote));
}

function toggleFlam(dispatch, selectedNote) {
    dispatch(scoreActions.toggleFlam(selectedNote));
}

function toggleDiddle(dispatch, selectedNote) {
    dispatch(scoreActions.toggleDiddle(selectedNote));
}

function toggleCheese(dispatch, selectedNote) {
    dispatch(scoreActions.toggleCheese(selectedNote));
}

function toggleLeftSticking(dispatch, selectedNote) {
    dispatch(scoreActions.toggleLeftSticking(selectedNote));
}

function toggleRightSticking(dispatch, selectedNote) {
    dispatch(scoreActions.toggleRightSticking(selectedNote));
}