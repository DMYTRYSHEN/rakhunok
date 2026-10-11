import argparse
import math
import os
import sys

import bpy
from mathutils import Euler, Vector


parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
rig = bpy.data.objects['RIG-Snow']
properties = rig.pose.bones['Properties']
properties['ik_left_upperarm'] = 0.0
properties['ik_right_upperarm'] = 0.0
rig.pose.bones['Properties_Character_Snow']['Quality'] = 1
sources = [obj for obj in bpy.context.scene.objects
           if obj.type in {'MESH', 'CURVE', 'CURVES'} and obj.name.startswith('GEO')
           and obj.name not in {'GEO-snow_eye_corneas', 'GEO-snow-eye_dots'} and obj.visible_get()]
for source in sources:
    for modifier in source.modifiers:
        if modifier.type == 'SUBSURF':
            modifier.levels = 1
            modifier.render_levels = 1
    source.animation_data_clear()

poses = {
    'idle': (-65, 0, 65, 0, 0),
    'listen': (-65, -10, 5, -95, -8),
    'think': (-65, -10, 35, -110, 8),
    'speak': (-35, -35, 35, -55, 0),
    'success': (-55, -10, -60, -45, -4),
    'error': (-40, -35, 40, -35, 6),
    'payment': (-65, -10, 35, -65, 0),
    'scan': (-55, -20, 25, -60, 5),
    'waiting': (-65, -5, 65, -5, 2),
    'confirm': (-50, -25, 30, -65, -5),
    'create': (-60, -15, 30, -70, 3),
}
poses.update({
    'greet': (-65, -10, -20, -110, -3),
    'wave': (-65, -10, -20, -110, 3),
    'listenTilt': poses['listen'][:-1] + (-12,),
    'thinkShift': poses['think'][:-1] + (12,),
    'speakOpen': poses['speak'],
    'successPulse': poses['success'][:-1] + (-7,),
    'errorShift': poses['error'][:-1] + (10,),
})
controls = ['FK-UpperArm.L', 'FK-Forearm.L', 'FK-UpperArm.R', 'FK-Forearm.R', 'FK-Head']
original = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}


def update_rig():
    rig.update_tag()
    bpy.context.view_layer.update()


def rotate(name, angles):
    bone = rig.pose.bones[name]
    bone.rotation_mode = 'XYZ'
    bone.rotation_euler = Euler(tuple(math.radians(angle) for angle in angles))


def reach(target):
    shoulder = rig.pose.bones['FK-UpperArm.R']
    elbow = rig.pose.bones['FK-Forearm.R']
    target = Vector(target)
    joints = [(shoulder, 0, -100, 100), (shoulder, 1, -100, 100),
              (shoulder, 2, -80, 80), (elbow, 0, 5, 145)]
    for step in [20, 10, 5, 2, 1]:
        for iteration in range(12):
            improved = False
            for bone, axis, minimum, maximum in joints:
                current = bone.rotation_euler[axis]
                best = current
                best_distance = (elbow.tail - target).length
                for direction in [-1, 1]:
                    candidate = max(math.radians(minimum), min(math.radians(maximum), current + math.radians(step * direction)))
                    bone.rotation_euler[axis] = candidate
                    update_rig()
                    distance = (elbow.tail - target).length
                    if elbow.tail.y <= elbow.head.y + 0.03 and distance < best_distance:
                        best, best_distance = candidate, distance
                bone.rotation_euler[axis] = best
                improved |= best != current
                update_rig()
            if not improved:
                break
    distance = (elbow.tail - target).length
    if distance > 0.055:
        raise RuntimeError(f'Hand misses gesture target: {distance:.3f}m / {target}')
    print(f'GESTURE hand target error={distance:.4f}m', flush=True)


def pose(state, values):
    for name, matrix in original.items():
        rig.pose.bones[name].matrix_basis = matrix
    for name, degrees in zip(controls, values):
        bone = rig.pose.bones[name]
        bone.rotation_mode = 'XYZ'
        axis = 0 if 'Forearm' in name else 2
        rotation = [0.0, 0.0, 0.0]
        rotation[axis] = math.radians(-degrees if 'Forearm' in name else degrees)
        bone.rotation_euler = Euler(rotation)
    update_rig()
    if state.startswith('listen'):
        reach((-0.145, -0.045, 1.62))
        rotate('FK-Wrist.R', (0, -15, 12))
    if state.startswith(('think', 'error')):
        reach((-0.04, -0.15, 1.51))
        rotate('FK-Wrist.R', (15, 0, -10))
        rotate('FK-Head', (12 if state.startswith('error') else 5, 0, values[-1]))
        if state.startswith('error'):
            rotate('FK-Chest', (10, 0, -5))
        for side, sign in [('L', 1), ('R', -1)]:
            rotate(f'MSTR-Eyebrow.{side}', (0, 0, sign * (12 if state.startswith('error') else -7)))
    if state in {'greet', 'wave'}:
        reach((-0.36, -0.12, 1.66))
        rotate('FK-Wrist.R', (0, -25, 20 if state == 'wave' else -20))
    if state.startswith('success'):
        reach((-0.28, -0.30, 1.40))
        rotate('FK-Wrist.R', (0, -65, -15))
    if state.startswith(('success', 'think', 'error')):
        for finger in ['Index', 'Middle', 'Ring', 'Pinky']:
            for segment in [1, 2, 3]:
                rotate(f'Finger_{finger}{segment}.R', (65 if state.startswith('success') else 35, 0, 0))
    if state == 'speakOpen':
        rotate('Jaw', (12, 0, 0))
        rig.pose.bones['MSTR-Lip_Bottom'].location.y -= 0.003
    update_rig()
    for side in ['L', 'R']:
        forearm = rig.pose.bones[f'FK-Forearm.{side}']
        if forearm.tail.y > forearm.head.y + 0.03:
            raise RuntimeError(f'Elbow bends backward: {side} / {values}')


def evaluated_mesh(source):
    graph = bpy.context.evaluated_depsgraph_get()
    return bpy.data.meshes.new_from_object(source.evaluated_get(graph), depsgraph=graph)


pose('idle', poses['idle'])
exports = []
for source in sources:
    mesh = evaluated_mesh(source)
    target = bpy.data.objects.new(source.name.replace('GEO-snow', 'Snow'), mesh)
    bpy.context.collection.objects.link(target)
    target.matrix_world = source.matrix_world
    if source.name == 'GEO-snow-eye_anim':
        if len({polygon.material_index for polygon in mesh.polygons}) != 3:
            raise RuntimeError('Eye sclera, iris and pupil materials were lost')
    target.shape_key_add(name='Basis')
    exports.append((source, target))

for state, values in poses.items():
    if state == 'idle':
        continue
    pose(state, values)
    displacement = 0.0
    for source, target in exports:
        mesh = evaluated_mesh(source)
        if len(mesh.vertices) != len(target.data.vertices):
            raise RuntimeError(f'Topology changed: {source.name} / {state}')
        shape = target.shape_key_add(name=state)
        coordinates = [0.0] * (len(mesh.vertices) * 3)
        mesh.vertices.foreach_get('co', coordinates)
        shape.data.foreach_set('co', coordinates)
        displacement += sum((vertex.co - base.co).length for vertex, base in zip(mesh.vertices, target.data.vertices))
        bpy.data.meshes.remove(mesh)
    print(f'POSE {state}: displacement={displacement:.4f}', flush=True)
    if displacement < 0.01:
        raise RuntimeError(f'Rig did not deform: {state}')

colors = {
    'snow.skin': (0.72, 0.44, 0.31, 1),
    'snow.skin_darker': (0.53, 0.26, 0.20, 1),
    'snow.skin_upper_lip': (0.46, 0.17, 0.16, 1),
    'snow.skin_lower_lip': (0.62, 0.25, 0.23, 1),
    'snow.shirt': (0.035, 0.16, 0.13, 1),
    'snow.pants': (0.035, 0.045, 0.052, 1),
    'snow.shoe': (0.022, 0.025, 0.026, 1),
    'snow.hair': (0.055, 0.028, 0.021, 1),
}
for name, color in colors.items():
    material = bpy.data.materials.get(name)
    if not material:
        continue
    material.node_tree.nodes.clear()
    shader = material.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = 0.48 if 'skin' in name else 0.65
    if name == 'snow.hair':
        for filename, socket in [('hair_diffuse.png', 'Base Color'), ('hair_roughness.png', 'Roughness')]:
            texture = material.node_tree.nodes.new('ShaderNodeTexImage')
            texture.image = bpy.data.images.load(bpy.path.abspath('//textures/' + filename), check_existing=True)
            if socket == 'Roughness':
                texture.image.colorspace_settings.name = 'Non-Color'
            material.node_tree.links.new(texture.outputs['Color'], shader.inputs[socket])
    if 'skin' in name:
        shader.inputs['Subsurface Weight'].default_value = 0.07
    output = material.node_tree.nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])

bpy.ops.object.select_all(action='DESELECT')
for source, target in exports:
    target.select_set(True)
    target['source'] = 'Snow Rig (CC) Blender Foundation | studio.blender.org'
os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(args.output), export_format='GLB', use_selection=True,
    export_animations=False, export_morph=True, export_morph_normal=False,
    export_extras=True, export_cameras=False, export_lights=False,
)
print(f'EXPORTED {args.output}: {os.path.getsize(args.output)} bytes', flush=True)