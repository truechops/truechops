import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  emailAuthContainer: {
    width: 500,
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    marginBottom: 25,
  },
  error: {
    color: "red",
    marginLeft: "8px",
  },
  centeredTopQuarter: {
    position: "fixed",
    top: "25%",
    left: "50%",
    transform: 'translateX(-50%)'
  },
  signUpHeading: {
    textAlign: "center",
    marginTop: 50,
    marginBottom: 11,
  },
  loginButton: {
    width: 240,
    margin: "auto",
    marginBottom: 20,
    display: "block",
  },
  continueButton: {
    textAlign: "center",
    width: 250,
    margin: "auto",
  },
  loginButtonsContainer: {
    width: 500,
    margin: "auto",
    display: "flex",
    marginBottom: 25,
  },
}));

export default useStyles;
