import React from 'react';
import './ButtonExamples.css';

const ButtonExamples: React.FC = () => {
  return (
    <div className="button-examples">
      <h2>Button Theme Examples</h2>

      <section>
        <h3>Primary Variants</h3>
        <div className="button-group">
          <button className="btn btn-primary">Primary Button</button>
          <button className="btn btn-primary btn-sm">Small</button>
          <button className="btn btn-primary btn-lg">Large</button>
          <button className="btn btn-primary" disabled>Disabled</button>
        </div>
      </section>

      <section>
        <h3>Button Types</h3>
        <div className="button-group">
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-success">Success</button>
          <button className="btn btn-danger">Danger</button>
          <button className="btn btn-warning">Warning</button>
          <button className="btn btn-info">Info</button>
        </div>
      </section>

      <section>
        <h3>Outline Variants</h3>
        <div className="button-group">
          <button className="btn btn-outline-primary">Outline Primary</button>
          <button className="btn btn-outline-danger">Outline Danger</button>
          <button className="btn btn-ghost">Ghost Button</button>
        </div>
      </section>

      <section>
        <h3>Special States</h3>
        <div className="button-group">
          <button className="btn btn-primary btn-loading">Loading...</button>
          <button className="btn btn-icon">
            <span>★</span>
          </button>
        </div>
      </section>

      <section>
        <h3>Legacy Compatibility</h3>
        <div className="button-group">
          <button className="login-button">Login Button</button>
          <button className="admin-login-button">Admin Login</button>
          <button className="btn-edit">Edit</button>
          <button className="btn-delete">Delete</button>
          <button className="retry-button">Retry</button>
        </div>
      </section>
    </div>
  );
};

export default ButtonExamples;