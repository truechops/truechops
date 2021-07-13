import { useEffect, useState } from "react";
import TextField from "@material-ui/core/TextField";
import useAuthStyles from "./auth-styles";
import Button from "@material-ui/core/Button";
import { useDispatch} from "react-redux";
import * as Realm from "realm-web";
import { login } from "../../store/realm-app";
import { useRouter } from 'next/router';
import DividerWithText from "../ui/DividerWithText";
import SocialButtons from './SocialButtons';

export default function AuthForm(props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const { isSignUp, error, setError, facebookText, googleText, emailHeading, continueText } = props;
  let continueEnabled = !!email && !!password;
  const router = useRouter();
  const dispatch = useDispatch();

  if (isSignUp) {
    continueEnabled = continueEnabled && !!firstName && !!lastName;
  }

  //Hack until react-social-login-buttons has type="button" as default 
  // (https://github.com/MichalSzorad/react-social-login-buttons/pull/58)
  useEffect(() => {
    $("#facebookButton button").attr('type', 'button');
    $("#googleButton button").attr('type', 'button');
  }, [])

  const classes = useAuthStyles();

  const emailChangeHandler = (e) => {
    setError((state) => ({
      ...state,
      email: null,
    }));

    setEmail(e.target.value);
  };

  const passwordChangeHandler = (e) => {
    setError((state) => ({
      ...state,
      passwordsDontMatch: false,
      password: null,
    }));

    setPassword(e.target.value);
  };

  const confirmPasswordChangeHandler = (e) => {
    setError((state) => ({
      ...state,
      passwordsDontMatch: false,
      password: null,
    }));

    setConfirmPassword(e.target.value);
  };

  const googleSignInHandler = async () => {
    const redirectUri = `${window.location.origin}/oathRedirect`;
    console.log('submitting google!');
    // Calling logIn() opens a Google authentication screen in a new window.
    try {
      await dispatch(login(Realm.Credentials.google(redirectUri)));
      router.push("/");
    } catch (err) {
      handleAuthenticationError(err);
    }
  };

  const facebookSignInHandler = async () => {
    const redirectUri = `${window.location.origin}/oathRedirect`;
    // Calling logIn() opens a Facebook authentication screen in a new window.
    try {
      await dispatch(login(Realm.Credentials.facebook(redirectUri)));
      router.push("/");
    } catch (err) {
      handleAuthenticationError(err);
    }
  };

  const onSubmitHandler = (e) => {
    e.preventDefault();
    console.log("submitting form!!!")

    if (isSignUp && password != confirmPassword) {
      setError((state) => ({
        ...state,
        passwordsDontMatch: true,
      }));

      return;
    }

    if (isSignUp) {
      props.onSubmitHandler(firstName, lastName, email, password);
    } else {
      props.onSubmitHandler(email, password);
    }
  };

  function handleAuthenticationError(err) {
    const { status, message } = parseAuthenticationError(err);
    const errorType = message || status;
    switch (errorType) {
      case "invalid username":
        setError((prevErr) => ({
          ...prevErr,
          email: "Invalid email address.",
        }));
        break;
      case "invalid username/password":
      case "invalid password":
      case "401":
        setError((err) => ({ ...err, password: "Incorrect password." }));
        break;
      case "name already in use":
      case "409":
        setError((err) => ({ ...err, email: "Email is already registered." }));
        break;
      case "password must be between 6 and 128 characters":
      case "400":
        setError((err) => ({
          ...err,
          password: "Password must be between 6 and 128 characters.",
        }));
        break;
      default:
        break;
    }
  }

  function parseAuthenticationError(err) {
    const parts = err.message.split(":");
    const reason = parts[parts.length - 1].trimStart();
    if (!reason) return { status: "", message: "" };
    const reasonRegex = /(?<message>.+)\s\(status (?<status>[0-9][0-9][0-9])/;
    const match = reason.match(reasonRegex);
    const { status, message } = match?.groups ?? {};
    return { status, message };
  }

  let emailErrorMessage = "";
  let passwordErrorMessage = "";
  let passwordsDontMatchErrorMessage = "";
  if (error) {
    if (error.email) {
      emailErrorMessage = <div className={classes.error}>{error.email}</div>;
    }
    if (error.password) {
      passwordErrorMessage = (
        <div className={classes.error}>{error.password}</div>
      );
    }
    if (error.passwordsDontMatch) {
      passwordsDontMatchErrorMessage = (
        <div className={classes.error}>Passwords don't match</div>
      );
    }
  }

  const nameFields = (
    <>
      <TextField
        id="standard-full-width"
        label="First Name"
        style={{ margin: 8 }}
        fullWidth
        required
        margin="normal"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <TextField
        id="standard-full-width"
        label="Last Name"
        style={{ margin: 8 }}
        fullWidth
        required
        margin="normal"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
    </>
  );

  const emailAuthFields = (
    <>
      <TextField
        id="email"
        label="Email"
        style={{ margin: 8 }}
        fullWidth
        type="email"
        margin="normal"
        onChange={emailChangeHandler}
        value={email}
      />
      {emailErrorMessage}
      <TextField
        id="password"
        label="Password"
        style={{ margin: 8 }}
        type="password"
        fullWidth
        required
        margin="normal"
        value={password}
        onChange={passwordChangeHandler}
      />
      {passwordErrorMessage}
      {isSignUp && (
        <TextField
          id="confirmPassword"
          label="Confirm Password"
          style={{ margin: 8 }}
          type="password"
          fullWidth
          required
          margin="normal"
          value={confirmPassword}
          onChange={confirmPasswordChangeHandler}
        />
      )}
      {passwordsDontMatchErrorMessage}
      <div className={classes.continueButton}>
        <Button
          type="submit"
          fullWidth
          variant="outlined"
          color="primary"
          disabled={!continueEnabled}
        >
          {continueText}
        </Button>
      </div>
    </>
  );

  const socialButtons = (
    <>
      <DividerWithText>or</DividerWithText>
      <SocialButtons
        fontSize="16px"
        facebook={{
          onClickHandler: facebookSignInHandler,
          text: facebookText,
        }}
        google={{
          onClickHandler: googleSignInHandler,
          text: googleText,
        }}
      />
    </>
  );

  const form = (
    <form onSubmit={onSubmitHandler}>
      <div className={classes.emailAuthContainer}>
        <h3 className={classes.signUpHeading}>{emailHeading}</h3>
        {isSignUp && nameFields}
        {emailAuthFields}
        {socialButtons}
      </div>
    </form>
  );
  return { form, handleAuthenticationError };
}
