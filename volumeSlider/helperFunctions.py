import numpy as np
from qtpy import QtWidgets, QtCore, QtGui
from numpy import moveaxis
from skimage.transform import rescale
#import matplotlib.pyplot as plt
#from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection, Line3DCollection
from flika import global_vars as g
from pathlib import Path

##############       Helper functions        ###########################################

#============GUI SETUP===========================================================
def windowGeometry(instance, left=300, top=300, height=600, width=400):
    instance.left = left
    instance.top = top
    instance.height = height
    instance.width = width
    return

def setSliderUp(slider, minimum=0, maximum=100, tickInterval=1, singleStep=1, value=0):
    slider.setFocusPolicy(QtCore.Qt.StrongFocus)
    slider.setTickPosition(QtWidgets.QSlider.TicksBothSides)
    slider.setMinimum(minimum)
    slider.setMaximum(maximum)
    slider.setTickInterval(tickInterval)
    slider.setSingleStep(singleStep)
    slider.setValue(value)
    return

def setMenuUp(menuItem,menu,shortcut='Ctrl+X',statusTip='Exit',connection=None):
    if shortcut != None:
        menuItem.setShortcut(shortcut)
    menuItem.setStatusTip(statusTip)
    menuItem.triggered.connect(connection)
    menu.addAction(menuItem)
    return
#=================================================================================

# The shear transform lives in shear_transform.py (Qt-free, tested); the 3D viewer imports it from here.
from .shear_transform import get_transformation_matrix, get_transformation_coordinates  # noqa: F401
from .shear_transform import perform_shear_transform as _perform_shear_transform
from .shear_transform import DEFAULT_DISPLAY_ORDER, DEFAULT_INPUT_ORDER


def _status(message):
    print(message)
    g.m.statusBar().showMessage(message)


def perform_shear_transform(A, shift_factor, interpolate, datatype, theta, inputArrayOrder=DEFAULT_INPUT_ORDER,
                            displayArrayOrder=DEFAULT_DISPLAY_ORDER, upsample_axis=None):
    return _perform_shear_transform(A, shift_factor, interpolate, datatype, theta, inputArrayOrder=inputArrayOrder,
                                    displayArrayOrder=displayArrayOrder, progress=_status, upsample_axis=upsample_axis)

def getCorners(vol):
    z,x,y = vol.nonzero()
    z_min = np.min(z)
    z_max = np.max(z)
    x_min = np.min(x)
    x_max = np.max(x)
    y_min = np.min(y)
    y_max = np.max(y)
    newArray = np.zeros(vol.shape)

    newArray[z_min,x_min,y_min] = 1
    newArray[z_min,x_max,y_min] = 1
    newArray[z_min,x_min,y_max] = 1
    newArray[z_min,x_max,y_max] = 1
    newArray[z_max,x_min,y_min] = 1
    newArray[z_max,x_max,y_min] = 1
    newArray[z_max,x_min,y_max] = 1
    newArray[z_max,x_max,y_max] = 1
    return newArray

def getDimensions(vol):
    z,x,y = vol.nonzero()
    return np.min(x),np.max(x),np.min(y),np.max(y),np.min(z),np.max(z)

def getMaxDimension(vol):
    z,x,y = vol.nonzero()
    return np.max([np.max(x),np.max(y),np.max(z)])

def plot_cube(ax, cube_definition):
    cube_definition_array = [
        np.array(list(item))
        for item in cube_definition
    ]

    points = []
    points += cube_definition_array
    vectors = [
        cube_definition_array[1] - cube_definition_array[0],
        cube_definition_array[2] - cube_definition_array[0],
        cube_definition_array[3] - cube_definition_array[0]
    ]

    points += [cube_definition_array[0] + vectors[0] + vectors[1]]
    points += [cube_definition_array[0] + vectors[0] + vectors[2]]
    points += [cube_definition_array[0] + vectors[1] + vectors[2]]
    points += [cube_definition_array[0] + vectors[0] + vectors[1] + vectors[2]]

    points = np.array(points)

    edges = [
        [points[0], points[3], points[5], points[1]],
        [points[1], points[5], points[7], points[4]],
        [points[4], points[2], points[6], points[7]],
        [points[2], points[6], points[3], points[0]],
        [points[0], points[2], points[4], points[1]],
        [points[3], points[6], points[7], points[5]]
    ]

    # Plot faces
    faces = Poly3DCollection(edges, linewidths=1, edgecolors='k')
    faces.set_facecolor((0,0,0.1,0.1))

    ax.add_collection3d(faces)

    # Plot the points
    ax.scatter(points[:,0], points[:,1], points[:,2], s=0)

    ax.set_aspect('equal')
    


def shorten_path(file_path, length):
    return Path(*Path(file_path).parts[-length:])