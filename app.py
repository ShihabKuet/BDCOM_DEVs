from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask import abort
from sqlalchemy import or_, and_
from datetime import datetime

app = Flask(__name__)
#app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///forum.db'
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:bdcom0061@localhost:5432/bdcom_dev_forum'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

ADMIN_IP = '127.0.0.1'

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    type = db.Column(db.String(10))  # "Query" or "Patch"
    category = db.Column(db.String(20)) 
    ip_address = db.Column(db.String(45))  # to store IPv4 or IPv6
    last_modified_ip = db.Column(db.String(45)) 
    likes = db.Column(db.Integer, default=0)
    comments = db.relationship('Comment', backref='post', cascade='all, delete-orphan')
    likes_relation = db.relationship('PostLike', backref='post', cascade='all, delete-orphan')
    reference_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=True)
    reference = db.relationship('Post', remote_side=[id], backref='patches')

class PostLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    db.UniqueConstraint('post_id', 'ip_address', name='unique_post_ip')

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)

class Notice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserIP(db.Model):
    __tablename__ = 'user_ip'
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(45), unique=True, nullable=False)
    username = db.Column(db.String(100), nullable=False)

@app.route('/notices')
def get_notices():
    notices = Notice.query.order_by(Notice.created_at.desc()).limit(5).all()
    return jsonify([{'id': n.id, 'content': n.content} for n in notices])

@app.route('/notices', methods=['POST'])
def add_notice():
    if not is_admin():  # If you have an `is_admin()` check
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    content = data.get('content')
    if not content:
        return jsonify({'error': 'Content is required'}), 400

    notice = Notice(content=content)
    db.session.add(notice)
    db.session.commit()
    return jsonify({'message': 'Notice posted successfully'}), 201

@app.route('/admin/notice')
def notice_admin():
    return render_template('admin_notice.html')

@app.route('/bdf_manual')
def manual():
    return render_template('bdf_manual.html')

def is_admin():
    return request.remote_addr == ADMIN_IP

@app.context_processor
def inject_year():
    return {'current_year': datetime.now().year}

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/my-ip')
def get_my_ip():
    return jsonify({'ip': request.remote_addr})

@app.route('/posts', methods=['GET', 'POST'])
def posts():
    if request.method == 'POST':
        data = request.json
        ip = request.remote_addr
        reference_id = data.get('reference_id')
        new_post = Post(
            title=data['title'],
            content=data['content'],
            type=data['type'],
            category=data['category'],
            ip_address=ip,
            last_modified_ip=ip,
            reference_id=reference_id
        )
        db.session.add(new_post)
        db.session.commit()
        return jsonify({'message': 'Post added successfully'}), 201
    else:
        # Pagination parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        #
        user_ip = request.remote_addr
        #all_posts = Post.query.order_by(Post.id.desc()).all()
        paginated_posts = Post.query.order_by(Post.id.desc()).paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'posts': [{
                'id': post.id,
                'title': post.title,
                'content': post.content,
                'type': post.type,
                'ip_address': post.ip_address,
                'category': post.category,
                'last_modified_ip': post.last_modified_ip,
                'likes': post.likes,
                'liked': PostLike.query.filter_by(post_id=post.id, ip_address=user_ip).first() is not None
            } for post in paginated_posts.items],
            'has_next': paginated_posts.has_next,
            'has_prev': paginated_posts.has_prev,
            'page': paginated_posts.page,
            'total_pages': paginated_posts.pages
        })
    
@app.route('/posts/summary')
def post_summaries():
    posts = Post.query.order_by(Post.id.desc()).all()
    return jsonify([
        {'id': post.id, 'title': post.title, 'type': post.type}
        for post in posts
    ])

@app.route('/create', methods=['GET'])
def create_post_page():
    return render_template('create_post.html')

@app.route('/search')
def search():
    query = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip().lower()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    user_ip = request.remote_addr

    filters = []

    # Add search query filter if present
    if query:
        filters.append(or_(
            Post.title.ilike(f'%{query}%'),
            Post.content.ilike(f'%{query}%')
        ))

    # Add category filter if present
    if category:
        filters.append(Post.category.ilike(category))  # case-insensitive match

    filtered_query = Post.query.filter(and_(*filters)).order_by(Post.id.desc())
    paginated_posts = filtered_query.paginate(page=page, per_page=per_page, error_out=False)

    # Combine all filters with AND
    #posts = Post.query.filter(and_(*filters)).order_by(Post.id.desc()).all()

    return jsonify({
        'posts': [{
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'type': post.type,
            'ip_address': post.ip_address,
            'category': post.category,
            'last_modified_ip': post.last_modified_ip,
            'likes': post.likes,
            'liked': PostLike.query.filter_by(post_id=post.id, ip_address=user_ip).first() is not None
        } for post in paginated_posts.items],
        'has_next': paginated_posts.has_next,
        'has_prev': paginated_posts.has_prev,
        'page': paginated_posts.page,
        'total_pages': paginated_posts.pages
    })
    # return jsonify([{
    #     'id': post.id,
    #     'title': post.title,
    #     'content': post.content,
    #     'type': post.type,
    #     'ip_address': post.ip_address,
    #     'category': post.category,
    #     'last_modified_ip': post.last_modified_ip,
    #     'likes': post.likes,
    #     'liked': PostLike.query.filter_by(post_id=post.id, ip_address=user_ip).first() is not None
    # } for post in posts])

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    requester_ip = request.remote_addr

    if requester_ip == post.ip_address or requester_ip == '192.168.100.133':
        db.session.delete(post)
        db.session.commit()
        return jsonify({'message': 'Post deleted successfully'}), 200
    else:
        return jsonify({'error': 'Unauthorized to delete this post'}), 403

@app.route('/posts/<int:post_id>')
def get_post(post_id):
    post = Post.query.get_or_404(post_id)
    # Try to find username for submitter
    submitter = UserIP.query.filter_by(ip_address=post.ip_address).first()
    last_editor = UserIP.query.filter_by(ip_address=post.last_modified_ip).first()

    submitted_by = submitter.username if submitter and submitter.username else post.ip_address
    modified_by = last_editor.username if last_editor and last_editor.username else post.last_modified_ip
    return render_template('post.html', post=post, submitted_by=submitted_by, modified_by=modified_by)

@app.route('/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    post = Post.query.get_or_404(post_id)
    data = request.json

    post.title = data.get('title', post.title)
    post.content = data.get('content', post.content)
    post.type = data.get('type', post.type)
    post.category = data.get('category', post.category)
    post.last_modified_ip = request.remote_addr

    db.session.commit()
    return jsonify({'message': 'Post updated successfully'}), 200

@app.route('/like/<int:post_id>', methods=['POST'])
def toggle_like(post_id):
    post = Post.query.get_or_404(post_id)
    user_ip = request.remote_addr

    existing_like = PostLike.query.filter_by(post_id=post_id, ip_address=user_ip).first()

    if existing_like:
        # Unlike: remove the record and decrement likes
        db.session.delete(existing_like)
        post.likes = max(post.likes - 1, 0)
        db.session.commit()
        return jsonify({'likes': post.likes, 'liked': False}), 200
    else:
        # Like: add record and increment likes
        new_like = PostLike(post_id=post_id, ip_address=user_ip)
        db.session.add(new_like)
        post.likes += 1
        db.session.commit()
        return jsonify({'likes': post.likes, 'liked': True}), 201

@app.route('/comments/<int:post_id>', methods=['GET'])
def get_comments(post_id):
    comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.timestamp.asc()).all()
    return jsonify([{
        'id': c.id,
        'content': c.content,
        'ip_address': c.ip_address,
        'timestamp': c.timestamp.strftime('%Y-%m-%d %H:%M')
    } for c in comments])

@app.route('/comments/<int:post_id>', methods=['POST'])
def add_comment(post_id):
    data = request.get_json()
    content = data.get('content')
    ip_address = request.remote_addr

    comment = Comment(post_id=post_id, content=content, ip_address=ip_address)
    db.session.add(comment)
    db.session.commit()

    return jsonify({'message': 'Comment added successfully'}), 201

@app.route('/comments/<int:comment_id>', methods=['PUT'])
def edit_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    if comment.ip_address != request.remote_addr:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    comment.content = data.get('content', comment.content)
    db.session.commit()

    return jsonify({'message': 'Comment updated successfully'})

@app.route('/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    if comment.ip_address != request.remote_addr:
        return jsonify({'error': 'Unauthorized'}), 403

    db.session.delete(comment)
    db.session.commit()
    return jsonify({'message': 'Comment deleted successfully'})

#only for admin
@app.route('/admin/posts')
def admin_posts():
    if request.remote_addr != '127.0.0.1':
        abort(403)  # Forbidden

    posts = Post.query.order_by(Post.id.desc()).all()
    return render_template('admin_posts.html', posts=posts)

@app.route('/posts/<int:post_id>', methods=['PUT', 'DELETE'])
def update_or_delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    user_ip = request.remote_addr

    if request.method == 'DELETE':
        if user_ip != post.ip_address and user_ip != '127.0.0.1':
            return jsonify({'error': 'Unauthorized'}), 403
        db.session.delete(post)
        db.session.commit()
        return jsonify({'message': 'Deleted'}), 200

    elif request.method == 'PUT':
        data = request.json
        if user_ip != post.ip_address and user_ip != '127.0.0.1':
            return jsonify({'error': 'Unauthorized'}), 403

        if 'title' in data:
            post.title = data['title']
        if 'category' in data:
            post.category = data['category']
        if 'type' in data:
            post.type = data['type']
        if 'content' in data:
            post.content = data['content']

        post.last_modified_ip = user_ip
        db.session.commit()
        return jsonify({'message': 'Updated'}), 200

#only for admin ends

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='127.0.0.1', port=5000, debug=True)
