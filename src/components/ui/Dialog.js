import { Dialog, DialogContent, DialogActions, Button} from '@material-ui/core';
import { makeStyles } from "@material-ui/styles";

export default function TCDialog(props) 
{
  const useStyles = makeStyles({
    button: {
      label: {
        color: "blue",
      },
      disabled: {
        color: "brown",
      },
    },
  });

  const classes = useStyles();

    return <Dialog
        maxWidth="xs"
        aria-labelledby="confirmation-dialog-title"
        open={props.isOpen}
      >
        <DialogContent dividers>
          {props.message}
        </DialogContent>
        <DialogActions>
          {props.onCancel && <Button autoFocus onClick={props.onCancel} color="primary">
            Cancel
          </Button>}
          <Button disabled={props.okDisabled} onClick={props.onOk} color="primary"
          
          //Even though these styles aren't used for some reason, it does seem to
            //prevent an ios bug where the ok button color was not getting updated from
            //the disabled color when it became enabled.
            classes={{ label: classes.button.label }}
          >
            Ok
          </Button>
        </DialogActions>
      </Dialog>
}