import {
  GoogleLoginButton
} from "react-social-login-buttons";
import useAuthStyles from "./auth-styles";

export default function SocialButtons(props) {
  const classes = useAuthStyles();
  return (
      <>
      {/* <div id="facebookButton" className={classes.loginButton}>
        <FacebookLoginButton
          type="button"
          style={{ fontSize: props.fontSize }}
          text={props.facebook.text}
          onClick={props.facebook.onClickHandler}
        />
      </div> */}
      <div id="googleButton" className={classes.loginButton}>
        <GoogleLoginButton
          type="button"
          style={{ fontSize: props.fontSize }}
          text={props.google.text}
          onClick={props.google.onClickHandler}
        />
      </div>
      </>
  );
}
