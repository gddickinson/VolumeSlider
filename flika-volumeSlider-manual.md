# VolumeSlider Plugin for Flika - User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
   - [Installation](#installation)
   - [Launching the Plugin](#launching-the-plugin)
   - [Data Loading Options](#data-loading-options)
   - [The Main Interface](#the-main-interface)
3. [Basic Operations](#basic-operations)
   - [Navigating Through Volumes](#navigating-through-volumes)
   - [Setting Volume Parameters](#setting-volume-parameters)
   - [Adjusting Display Settings](#adjusting-display-settings)
4. [Data Processing](#data-processing)
   - [Baseline Subtraction](#baseline-subtraction)
   - [Ratio DF/F0 Calculation](#ratio-dff0-calculation)
   - [Applying Multiplication Factors](#applying-multiplication-factors)
   - [Changing Data Type](#changing-data-type)
5. [3D Viewer](#3d-viewer)
   - [Launching the 3D Viewer](#launching-the-3d-viewer)
   - [Understanding the Interface](#understanding-the-interface)
   - [Navigation Controls](#navigation-controls)
   - [Cross-sectional Views](#cross-sectional-views)
6. [Advanced Visualization](#advanced-visualization)
   - [3D Scatter Plot](#3d-scatter-plot)
   - [Texture Plot](#texture-plot)
   - [ROI Analysis](#roi-analysis)
7. [Overlay Features](#overlay-features)
   - [Loading Overlay Data](#loading-overlay-data)
   - [Overlay Options](#overlay-options)
   - [Quick Overlay](#quick-overlay)
   - [Scale Bar Configuration](#scale-bar-configuration)
8. [Data Export](#data-export)
   - [Exporting to Flika Window](#exporting-to-flika-window)
   - [Saving as Numpy Array](#saving-as-numpy-array)
   - [Exporting to Imaris](#exporting-to-imaris)
9. [Batch Processing](#batch-processing)
   - [Setting Up Batch Parameters](#setting-up-batch-parameters)
   - [Running a Batch Job](#running-a-batch-job)
   - [Monitoring Progress](#monitoring-progress)
10. [Filter Options](#filter-options)
    - [Gaussian Filter](#gaussian-filter)
11. [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
    - [Performance Optimization](#performance-optimization)
12. [Advanced Topics](#advanced-topics)
    - [Shear Transformation Parameters](#shear-transformation-parameters)
    - [Input and Display Array Order](#input-and-display-array-order)
    - [Custom Colormap Configuration](#custom-colormap-configuration)

## Introduction

VolumeSlider is a specialized plugin for Flika designed for scientists and researchers working with volumetric imaging data. It excels in handling multi-dimensional datasets from techniques such as light sheet microscopy, confocal microscopy, and other volumetric imaging methods.

This manual provides detailed instructions on how to use the VolumeSlider plugin effectively, from basic operations to advanced analysis techniques.

## Getting Started

### Installation

1. Ensure you have Flika installed (version 0.2.23 or newer recommended)
2. Place the VolumeSlider plugin folder in your Flika plugins directory:
   - Windows: `C:\Users\[username]\.Flika\plugins\volumeSlider`
   - macOS: `/Users/[username]/.Flika/plugins/volumeSlider`
   - Linux: `/home/[username]/.Flika/plugins/volumeSlider`
3. Restart Flika if it's already running

### Launching the Plugin

1. Open Flika
2. Select `Plugins → VolumeSlider → VolumeSlider` from the menu
3. A dialog will appear with options for loading data

### Data Loading Options

The plugin offers multiple ways to load data:

- **Current Window**: Uses the data from the currently active Flika window
- **Numpy Array**: Loads data from a saved Numpy (.npy) file
- **Batch Process**: Sets up processing for multiple files (covered in the [Batch Processing](#batch-processing) section)

You can also specify whether to keep the original window open after loading the data.

### The Main Interface

The main VolumeSlider interface consists of:

1. **Volume Controls**: Sliders and spinboxes for navigating through slices
2. **Processing Options**: Buttons for data manipulation operations
3. **Parameter Settings**: Input fields for processing parameters
4. **Status Information**: Display of current data shape, type, and properties
5. **3D Viewer Button**: Opens the 3D visualization interface

![Main Interface](placeholder_main_interface.png)

## Basic Operations

### Navigating Through Volumes

- Use the horizontal slider to navigate through slices
- The spinbox allows precise selection of a specific slice number
- The displayed slice is updated in real-time as you adjust these controls

### Setting Volume Parameters

1. Enter the desired number of slices per volume in the "# of slices per volume" field
2. Click the "Set Slices" button to apply the change
3. This organizes your data into volumes based on the specified number of slices
4. The total number of volumes is calculated and displayed

This step is crucial as it defines how your data is structured for all subsequent operations.

### Adjusting Display Settings

- **Autolevel**: Click the "Autolevel" button to automatically adjust brightness/contrast
- **Display Orientation**: The main window shows the currently selected slice in its native orientation

## Data Processing

### Baseline Subtraction

To remove background signal:

1. Enter the baseline value in the "baseline value" field
2. Click the "subtract baseline" button
3. This subtracts the specified value from all data points

### Ratio DF/F0 Calculation

This calculates changes relative to a baseline period (useful for functional imaging):

1. Set the "F0 start volume" and "F0 end volume" fields to define your baseline period
2. Set the "ratio start volume" and "ratio End volume" fields to define the range for calculation
3. Click the "run DF/F0" button
4. The plugin calculates: (F - F0) / F0 for each pixel

### Applying Multiplication Factors

To scale your data:

1. Enter the desired factor in the "factor to multiply by" field
2. Click the "multiply" button
3. All values in the dataset will be multiplied by this factor

### Changing Data Type

To change the numerical precision of your data:

1. Select the desired data type from the dropdown menu (float16, float32, etc.)
2. Click the "set data Type" button
3. Your data will be converted to the selected type
4. Note: Changing to lower precision may reduce memory usage but can lead to loss of detail

## 3D Viewer

### Launching the 3D Viewer

1. Click the "open 3D viewer" button in the main interface
2. A new window will open with multiple views of your data

### Understanding the Interface

The 3D Viewer consists of several panels:

- **Top View** (Upper Left): Maximum intensity projection from top
- **X Slice** (Upper Right): Cross-section along X axis
- **Y Slice** (Lower Left): Cross-section along Y axis
- **Free ROI** (Lower Right): Custom region of interest
- **Z Slice** (Additional Tab): Cross-section along Z axis
- **Time Slider**: Navigate through time points/volumes

![3D Viewer Interface](placeholder_3d_viewer.png)

### Navigation Controls

- **Yellow Crosshairs**: Click and drag to move the cross-sectional planes
- **Time Slider**: Slide to change the currently displayed volume
- **ROI Center**: Click and drag the center point to move all cross-sections simultaneously

### Cross-sectional Views

The cross-sectional views are linked. When you move the yellow lines in the top view:

- The X Slice view updates to show the vertical cross-section
- The Y Slice view updates to show the horizontal cross-section
- The Z Slice shows the current slice in the original orientation

## Advanced Visualization

### 3D Scatter Plot

To create a 3D scatter representation of your data:

1. Go to the "3D Plot" menu in the 3D Viewer
2. Select "3D Plot" to generate the visualization
3. Points above the threshold will be displayed in 3D space

To adjust plot parameters:

1. Go to "3D Plot → 3D Plot Options"
2. Adjust downsampling rate (smaller values = more points)
3. Set threshold level to control which points are displayed
4. Toggle display of array outline and plot axes

### Texture Plot

For a volumetric slice-based 3D view:

1. Go to "Texture Plot → Texture Plot" in the menu
2. A new window opens showing intersecting planes through your volume
3. To control the position of planes, go to "Texture Plot → Texture Plot Control"
4. Use sliders to adjust the position of each orthogonal plane

### ROI Analysis

To analyze specific regions:

1. Draw a line ROI in the top view by clicking and dragging the red line
2. The extracted profile appears in the Free ROI panel
3. This allows inspection of signal along any arbitrary path

## Overlay Features

### Loading Overlay Data

To compare multiple datasets:

1. Go to "Overlay → Overlay (from Array)" in the 3D Viewer menu
2. Select a Numpy array file to overlay on your current data
3. The overlay appears on all view panels

### Overlay Options

To adjust overlay appearance:

1. Go to "Overlay → Overlay Options"
2. Set properties:
   - **Color Map**: Choose from preset color maps
   - **Overlay Mode**: Select blending mode (Source Overlay, Plus, Multiply)
   - **Opacity**: Adjust transparency percentage
   - **Link Histograms**: Toggle whether histogram settings are linked across views

### Quick Overlay

For a faster workflow:

1. Click the "Overlay" button in the quick button dock
2. This uses the current volume as an overlay reference

### Scale Bar Configuration

To add and configure scale bars:

1. Go to "Overlay → Scale Bar Options"
2. Choose from options for different views (Top, Y, X, Z)
3. Configure:
   - **Units**: micro, nano, or pixels
   - **Width**: Size in chosen units
   - **Font size**: Adjust text size
   - **Color & Background**: Customize appearance
   - **Location**: Position on the view
   - **Orientation**: Horizontal or vertical

## Data Export

### Exporting to Flika Window

To create a new Flika window with processed data:

1. Click the "export to Window" button
2. A new Flika window opens containing your processed data

### Saving as Numpy Array

To save your data for future use:

1. Click the "export to array" button
2. Choose a location and filename in the dialog
3. Your data is saved as a .npy file that can be reloaded later

### Exporting to Imaris

For visualization in Imaris software:

1. Go to "Export → Export to Imaris" in the 3D Viewer menu
2. Configure export parameters:
   - File path
   - Subsampling and chunks
   - Compression method
   - Voxel dimensions and units
   - Color and gamma settings
3. Click "Export" to create the .ims file

## Batch Processing

### Setting Up Batch Parameters

1. Select "Batch Process" when launching VolumeSlider
2. In the Batch Options dialog, configure:
   - Processing parameters (slices per volume, theta, etc.)
   - Operations to perform (subtract baseline, run DF/F0, etc.)
   - Input directory containing files to process

### Running a Batch Job

1. Click the "Go" button to start processing
2. The plugin will:
   - Load each file in the input directory
   - Apply the configured operations
   - Export results according to your settings

### Monitoring Progress

- Progress messages appear in Flika's status bar
- After completion, a "finished batch processing" message will be displayed

## Filter Options

### Gaussian Filter

To apply Gaussian smoothing:

1. Go to "Filters → Gaussian" in the 3D Viewer menu
2. Adjust sigma value using the slider (higher values = more smoothing)
3. Click "Apply Gaussian" to process the data
4. Use "Undo Gaussian" to revert to the original data

## Troubleshooting

### Common Issues

- **Memory Errors**: For large datasets, try:
  - Using a lower precision data type (float16 instead of float32)
  - Processing fewer volumes at once
  - Closing other applications to free system memory

- **Display Issues**:
  - If no data appears, check that the slice number is within valid range
  - If the display is too dark/bright, use the "Autolevel" button
  - If 3D viewer shows empty panels, verify that volumes are properly configured

- **Processing Errors**:
  - If operations have no effect, ensure you've set the number of slices per volume
  - For ratio calculations, verify that your F0 range is valid and non-zero

### Performance Optimization

- **For Smoother Operation**:
  - Close unnecessary Flika windows
  - Use downsampling for large datasets
  - Consider reducing data precision if full precision isn't needed
  - For 3D scatter plots, use higher downsampling rates (lower density)

## Advanced Topics

### Shear Transformation Parameters

To correct for light sheet angle distortions:

1. Set the "theta" value to match your light sheet angle (typically 45 degrees)
2. Adjust "shift factor" to control the transformation magnitude
3. These parameters affect how the data is transformed for visualization

### Input and Display Array Order

For complex datasets with nonstandard dimension ordering:

1. Select appropriate input array order from the dropdown menu
2. Select the desired display array order
3. This controls how dimensions are interpreted and displayed

The available options correspond to different permutations of dimensions:
- `[0, 1, 2, 3]`: Default order
- `[0, 1, 3, 2]`, `[0, 2, 1, 3]`, etc.: Alternative dimension orderings

### Custom Colormap Configuration

To create custom colormaps:

1. Go to "Overlay → Overlay Options"
2. Select a base colormap from the presets
3. Open any histogram panel and click on the gradient
4. Add, move, or delete color stops to customize the gradient
5. Right-click the gradient to save your custom colormap for future use
