import { useState  } from "react";
import useAuthStyles from "./auth-styles";
import useAuthFormHook from "./auth-form-hook";
import CircularProgress from "@mui/material/CircularProgress";
import { appActions } from "../../store/app";
import { useDispatch } from "react-redux";

export default function Login() {
  const dispatch = useDispatch();

  // Keep track of input validation/errors
  const [error, setError] = useState({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loginHandler = async () => {
    setIsLoggingIn(true);
    setError({
      auth: "Email/password login used Atlas App Services and is no longer available. Use Google login instead.",
    });
    setIsLoggingIn(false);
  };

  const { form } = useAuthFormHook({
    isSignUp: false,
    onSubmitHandler: loginHandler,
    error,
    setError,
    facebookText: "Log In With Facebook",
    googleText: "Log In With Google",
    emailHeading: 'Log In by E-mail',
    continueText: 'Log In'
  });

  dispatch(appActions.setPageLoaded());

  const classes = useAuthStyles();
  return (
    <>
      {isLoggingIn && (
        <CircularProgress className={classes.centeredTopQuarter} />
      )}
      {!isLoggingIn && form}
    </>
  );
}
