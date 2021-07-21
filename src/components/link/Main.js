import Rhythm from "./Rhythm";

export default function Link({ linkId, linkType }) {
  let linkPage = null;
  console.log('linkType: ' + linkType);
  if (linkType === "rhythm") {
    linkPage = <Rhythm linkId={linkId} />;
  }

  return <>{ linkPage }</>;
}
