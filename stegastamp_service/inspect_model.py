import tensorflow as tf
import os

ENCODER_MODEL_DIR = os.path.join(os.path.dirname(__file__), "StegaStamp", "saved_models", "stegastamp_pretrained")

with tf.Session(graph=tf.Graph()) as sess:
    tf.saved_model.loader.load(sess, [tf.saved_model.tag_constants.SERVING], ENCODER_MODEL_DIR)
    
    # We want to find the placeholders (inputs) and the output tensors
    nodes = [n.name for n in sess.graph.as_graph_def().node]
    
    print("--- PLACEHOLDERS (Inputs) ---")
    for n in nodes:
        if 'input' in n.lower() or 'secret' in n.lower() or 'image' in n.lower():
            op = sess.graph.get_operation_by_name(n)
            if op.type == 'Placeholder':
                print(f"{n}: {op.outputs[0].shape if op.outputs else 'None'}")
                
    print("\n--- POSSIBLE OUTPUTS ---")
    output_keywords = ['clip', 'decoder/dense', 'sigmoid', 'round', 'add']
    for n in nodes:
        for kw in output_keywords:
            if kw in n.lower():
                op = sess.graph.get_operation_by_name(n)
                # print some interesting ops
                if 'clip_by_value' in n.lower() or 'decoder/' in n.lower() and 'biasadd' in n.lower():
                    print(f"Op: {n}")
