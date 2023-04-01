import dynamic from "next/dynamic";
import allExercises from '../data/exercises/all';
import { useTheme } from '@material-ui/core/styles';

const DynamicMain = dynamic(() => import("../src/components/rhythms/Main"), {
  ssr: false,
});

function getSvgConfig(windowWidth) {
    if(windowWidth < 900) {
        return {width: 275, scale: 0.8};
    } else {
        return {width: 300, scale: 1};
    }
} 

export default function main() {
    const theme = useTheme();
    function getHeight(window) {
        console.log("got height!");
        return window.height - theme.mixins.toolbar.minHeight;
    }
  return <DynamicMain rhythms={allExercises} getSvgConfig={getSvgConfig} 
                      getHeight={getHeight}/>;
}
