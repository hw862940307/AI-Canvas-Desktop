const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const eb = `
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null, info: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { this.setState({ info }); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '50px', color: 'red', background: 'black', width: '100%', height: '100vh', overflow: 'auto', zIndex: 9999, position: 'absolute'}}>
          <h1>Fatal React Error</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
`;

if (!app.includes('class ErrorBoundary')) {
  let appIdx = app.indexOf('export default function App() {');
  app = app.substring(0, appIdx) + eb + app.substring(appIdx);
  
  app = app.replace(
    '<ReactFlowProvider>', 
    '<ErrorBoundary><ReactFlowProvider>'
  );
  app = app.replace(
    '</ReactFlowProvider>', 
    '</ReactFlowProvider></ErrorBoundary>'
  );
  
  fs.writeFileSync('src/App.tsx', app);
  console.log("Boundary added!");
}
