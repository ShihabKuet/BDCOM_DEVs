from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///forum.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    type = db.Column(db.String(10))  # "problem" or "solution"
    ip_address = db.Column(db.String(45))  # to store IPv4 or IPv6

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/posts', methods=['GET', 'POST'])
def posts():
    if request.method == 'POST':
        data = request.json
        ip = request.remote_addr
        new_post = Post(
            title=data['title'],
            content=data['content'],
            type=data['type'],
            ip_address=ip
        )
        db.session.add(new_post)
        db.session.commit()
        return jsonify({'message': 'Post added successfully'}), 201
    else:
        all_posts = Post.query.order_by(Post.id.desc()).all()
        return jsonify([{
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'type': post.type,
            'ip_address': post.ip_address
        } for post in all_posts])

@app.route('/search')
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])

    posts = Post.query.filter(
        or_(
            Post.title.ilike(f'%{query}%'),
            Post.content.ilike(f'%{query}%')
        )
    ).order_by(Post.id.desc()).all()

    return jsonify([{
        'id': post.id,
        'title': post.title,
        'content': post.content,
        'type': post.type,
        'ip_address': post.ip_address
    } for post in posts])

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    db.session.delete(post)
    db.session.commit()
    return jsonify({'message': 'Post deleted successfully'}), 200

@app.route('/posts/<int:post_id>')
def get_post(post_id):
    post = Post.query.get_or_404(post_id)
    return render_template('post.html', post=post)

@app.route('/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    post = Post.query.get_or_404(post_id)
    data = request.json

    post.title = data.get('title', post.title)
    post.content = data.get('content', post.content)
    post.type = data.get('type', post.type)

    db.session.commit()
    return jsonify({'message': 'Post updated successfully'}), 200


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='192.168.100.133', port=5000, debug=True)
