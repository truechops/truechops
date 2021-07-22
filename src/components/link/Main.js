import Rhythm from "./Rhythm";
import { LINK_TYPES } from '../../consts/db';

export default function Link({ linkId, linkType }) {
  let linkPage = null;
  if (linkType === LINK_TYPES.rhythm) {
    linkPage = <Rhythm linkId={linkId} />;
  }

  return <>{ linkPage }</>;
}
