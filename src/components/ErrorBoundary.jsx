import { Component } from "react";
import PropTypes from 'prop-types';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
          <div className="text-center">
            <p className="text-red-600 font-semibold mb-2">Something went wrong</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-mono">
              {this.state.error.message}
            </p>
            <button
              className="mt-4 px-3 py-1 bg-[#356C99] text-white text-sm rounded hover:bg-[#0D486C]"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
