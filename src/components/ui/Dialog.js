import { Dialog, DialogContent, DialogActions, Button} from '@material-ui/core';
import { useState } from 'react';

export default function useDialog(props) 
{
    return <Dialog
        maxWidth="xs"
        aria-labelledby="confirmation-dialog-title"
        open={props.isOpen}
      >
        <DialogContent dividers>
          {props.message}
        </DialogContent>
        <DialogActions>
          {props.useCancel && <Button autoFocus onClick={props.setIsOpen.bind(null, false)} color="primary">
            Cancel
          </Button>}
          <Button disabled={props.disabled} onClick={props.onOk} color="primary">
            Ok
          </Button>
        </DialogActions>
      </Dialog>
}