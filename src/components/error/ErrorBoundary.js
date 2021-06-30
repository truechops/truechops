import React from 'react';
import ReactGA from 'react-ga';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.component = props.component;
      this.state = { hasError: false };
    }
  
    static getDerivedStateFromError(/*error*/) {
      // Update state so the next render will show the fallback UI.
      return { hasError: true };
    }
  
    componentDidCatch(/*error, errorInfo*/) {
        ReactGA.event({
            category: 'exception',
            action: this.component
          });
    }
  
    render() {
      if (this.state.hasError) {
        // You can render any custom fallback UI
       return <>Sorry, an unexpected error has occurred. Please reload the page.</>
      }

      return this.props.children; 
    }
  }