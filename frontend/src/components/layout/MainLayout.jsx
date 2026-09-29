import React from 'react';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import BottomNav from '../BottomNav';

const MainLayout = ({ children }) => {
  return (
    <div className="flex flex-col lg:flex-row h-screen bg-ink text-fg-muted overflow-hidden font-sans transition-colors duration-base">
      {/* Sidebar - Fixed on desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative w-full min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto w-full pb-dock-clearance lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
};

export default MainLayout;
