import { makeStyles } from "@mui/styles";

const useStyles = makeStyles(() => ({
  emailAuthContainer: {
    width: 325,
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
    marginTop: 20,
    marginBottom: 11,
  },
  loginButton: {
    width: 240,
    margin: "auto",
    display: "block",
  },
  continueButton: {
    textAlign: "center",
    width: 250,
    margin: "auto",
    marginTop: 25
  },
  loginButtonsContainer: {
    width: 325,
    margin: "auto",
    display: "flex",
    alignItems: 'vertical',
    marginBottom: 25,
  },
}));

export default useStyles;
