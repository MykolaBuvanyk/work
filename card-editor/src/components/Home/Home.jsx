import React from 'react';
import GlobalInputFormat from '../GlobalInputFormat';
import Header from '../Header/Header';
import TopSidebar from '../TopSidebar/TopSidebar';
import Toolbar from '../Toolbar/Toolbar';
import Accessories from '../Accessories/Accessories';
import ToolbarFooter from '../Toolbar/ToolbarFooter';
import TopToolbar from '../TopToolbar/TopToolbar';
import TextList from '../TextList/TextList';
import ProjectCanvasesGrid from '../ProjectCanvasesGrid/ProjectCanvasesGrid';
import Canvas from '../Canvas/Canvas';
import { CanvasProvider } from '../../contexts/CanvasContext';


const Home = () => {
  return (
    <CanvasProvider>
      <div className="home">
        <GlobalInputFormat />
        {
          //<Header />
        }
        <div className="main-wrapper">
          <div className="sidebar">
            <TopSidebar />
            <Toolbar />
            <Accessories />
            <ToolbarFooter />
            {/* <IconMenu /> */}
          </div>
          <div className="main-content">
            <TopToolbar className="topToolbar" />
            <Canvas className="canvas" />
            <TextList />
            <ProjectCanvasesGrid />
          </div>
        </div>
      </div>
    </CanvasProvider>
  );
};

export default Home;
