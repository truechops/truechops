export default function shuffle(config, notes) {
    console.log('shuffle');
    for (let i = notes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [notes[i], notes[j]] = [notes[j], notes[i]];
    }

    console.log('notes: ' + JSON.stringify(notes));
  }