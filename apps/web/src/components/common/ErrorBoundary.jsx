import React from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { captureException } from '../../utils/sentry.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CarMate ErrorBoundary] Uncaught component error:', error, errorInfo);
    captureException(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc] dark:bg-[#090d16] text-slate-800 dark:text-slate-200">
          <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-[#0f1422] border border-slate-200/80 dark:border-white/[0.08] text-center shadow-xl space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 inline-flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
              Đã xảy ra sự cố hiển thị
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Hệ thống đã tự động ghi nhận nhật ký để khắc phục. Vui lòng bấm tải lại để tiếp tục sử dụng.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full h-11 px-5 rounded-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tải lại ứng dụng</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
