from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask import abort
from sqlalchemy import or_, and_
from datetime import datetime
from html_diff import diff as html_diff

app = Flask(__name__)
#app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///forum.db'

# PostgreSQL credentials
DB_USERNAME = 'postgres'
DB_PASSWORD = 'bdcom0061'
DB_NAME = 'bdcom_dev_forum'
DB_HOST = 'localhost'
DB_PORT = '5432'
app.config['SQLALCHEMY_DATABASE_URI'] = f'postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

ADMIN_IP = '192.168.100.133'

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    type = db.Column(db.String(10))  # "Query" or "Patch"
    category = db.Column(db.String(20)) 
    ip_address = db.Column(db.String(45))  # to store IPv4 or IPv6
    last_modified_ip = db.Column(db.String(45)) 
    submitted_by = db.Column(db.String(50))
    last_modified_by = db.Column(db.String(50))
    likes = db.Column(db.Integer, default=0)
    comments = db.relationship('Comment', backref='post', cascade='all, delete-orphan')
    likes_relation = db.relationship('PostLike', backref='post', cascade='all, delete-orphan')
    history_relation = db.relationship('PostHistory', backref='original_post', cascade='all, delete-orphan', passive_deletes=True)
    reference_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=True)
    reference = db.relationship('Post', remote_side=[id], backref='patches')

class PostHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    type = db.Column(db.String(10))
    category = db.Column(db.String(20))
    edited_at = db.Column(db.DateTime, default=datetime.utcnow)
    edited_by = db.Column(db.String(50))
    edited_by_ip = db.Column(db.String(45))

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

@app.route('/notices/<int:notice_id>', methods=['PUT'])
def edit_notice(notice_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Content is required'}), 400

    notice = Notice.query.get_or_404(notice_id)
    notice.content = content
    db.session.commit()
    return jsonify({'message': 'Notice updated successfully'}), 200

@app.route('/notices/<int:notice_id>', methods=['DELETE'])
def delete_notice(notice_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403

    notice = Notice.query.get_or_404(notice_id)
    db.session.delete(notice)
    db.session.commit()
    return jsonify({'message': 'Notice deleted successfully'}), 200


@app.route('/admin/notice')
def notice_admin():
    if request.remote_addr != ADMIN_IP:
        abort(403)  # Forbidden
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

@app.route('/confirm_register_ip', methods=['POST'])
def confirm_register_ip():
    data = request.get_json()
    ip_address = data.get('ip_address')

    if not ip_address:
        return jsonify({'error': 'IP address is required'}), 400

    existing = UserIP.query.filter_by(ip_address=ip_address).first()
    if existing:
        return jsonify({
            'exists': True,
            'current_username': existing.username
        }), 200
    else:
        return jsonify({'exists': False}), 200


@app.route('/register_ip', methods=['GET', 'POST'])
def register_ip():
    if request.method == 'POST':
        data = request.get_json()
        ip_address = data.get('ip_address')
        username = data.get('username')

        if not ip_address or not username:
            return jsonify({'error': 'Both fields are required'}), 400

        # Check if IP exists already
        existing = UserIP.query.filter_by(ip_address=ip_address).first()
        if existing:
            existing.username = username  # update existing
        else:
            new_entry = UserIP(ip_address=ip_address, username=username)
            db.session.add(new_entry)

        db.session.commit()
        return jsonify({'message': 'IP registered successfully'}), 201

    return render_template('register_ip.html')

@app.route('/api/user_ips')
def get_user_ips():
    all_users = UserIP.query.order_by(UserIP.id.desc()).all()
    return jsonify([
        {'ip': u.ip_address, 'username': u.username} for u in all_users
    ])

@app.route('/posts', methods=['GET', 'POST'])
def posts():
    if request.method == 'POST':
        data = request.json
        ip = request.remote_addr
        reference_id = data.get('reference_id')
        submitted_by = data.get('submitted_by', ip)  # fallback to IP if username not provided
        last_modified_by = data.get('last_modified_by', ip)  # fallback to IP if username not provided

        new_post = Post(
            title=data['title'],
            content=data['content'],
            type=data['type'],
            category=data['category'],
            ip_address=ip,
            last_modified_ip=ip,
            submitted_by=submitted_by,
            last_modified_by=last_modified_by,
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
    user_ip = request.remote_addr
    known_user = db.session.query(UserIP).filter_by(ip_address=user_ip).first()
    return render_template('create_post.html', known_user=known_user.username if known_user else None)

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
            'submitted_by': post.submitted_by,
            'last_modified_by': post.last_modified_by,
            'likes': post.likes,
            'liked': PostLike.query.filter_by(post_id=post.id, ip_address=user_ip).first() is not None
        } for post in paginated_posts.items],
        'has_next': paginated_posts.has_next,
        'has_prev': paginated_posts.has_prev,
        'page': paginated_posts.page,
        'total_pages': paginated_posts.pages
    })

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
    current_ip = request.remote_addr  # Get current user's IP
    known_user = db.session.query(UserIP).filter_by(ip_address=current_ip).first()
    return render_template('post.html', post=post, current_ip=current_ip, admin_ip=ADMIN_IP, known_user=known_user.username if known_user else None)

@app.route("/similar-posts/<int:post_id>")
def get_similar_posts(post_id):
    original = Post.query.get_or_404(post_id)
    limit_no = 3 # max number of similar posts to return

    # Get a meaningful keyword from title and content (fallback if empty)
    title_keyword = original.title.split()[0] if original.title else ""
    content_keyword = original.content.split()[0] if original.content else ""

    similar = Post.query.filter(
        Post.id != post_id,
        or_(
            Post.title.ilike(f"%{title_keyword}%"),
            Post.category == original.category,
            Post.content.ilike(f"%{content_keyword}%")
        )
    ).order_by(Post.id.desc()).limit(limit_no).all()  # 👈 LIMIT to limit_no

    return jsonify([
        {"id": p.id, "title": p.title, "submitted_by": p.submitted_by}
        for p in similar
    ])

@app.route('/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    post = Post.query.get_or_404(post_id)
    data = request.json

    # Extract new values from request
    new_title = data.get('title', post.title)
    new_content = data.get('content', post.content)

    # Use html_diff to get basic <ins>/<del> diff
    raw_title_diff = html_diff(post.title or "", new_title or "")
    raw_content_diff = html_diff(post.content or "", new_content or "")

    # Wrap <ins> and <del> with custom styles for yellow highlight
    def apply_yellow_highlight(diff_text):
        return (diff_text
            .replace('<ins>', '<ins style="background-color: yellow;">')
            .replace('<del>', '<del style="background-color: #ffeeba; text-decoration: line-through;">'))

    highlighted_title = apply_yellow_highlight(raw_title_diff)
    highlighted_content = apply_yellow_highlight(raw_content_diff)

    # Save history before changing
    history = PostHistory(
        post_id=post.id,
        title=highlighted_title,
        content=highlighted_content,
        type=post.type,
        category=post.category,
        edited_by=data.get('last_modified_by', post.last_modified_by),
        edited_by_ip=request.remote_addr
    )
    db.session.add(history)

    # Apply updates
    post.title = data.get('title', post.title)
    post.content = data.get('content', post.content)
    post.type = data.get('type', post.type)
    post.category = data.get('category', post.category)
    post.last_modified_by = data.get('last_modified_by', post.last_modified_by)
    post.last_modified_ip = request.remote_addr

    db.session.commit()
    return jsonify({'message': 'Post updated successfully'}), 200

@app.route('/posts/<int:post_id>/history')
def post_history(post_id):
    post = Post.query.get_or_404(post_id)
    history = PostHistory.query.filter_by(post_id=post.id).order_by(PostHistory.edited_at.desc()).all()

    history_data = []
    for h in history:
        user = UserIP.query.filter_by(ip_address=h.edited_by_ip).first()
        history_data.append({
            'title': h.title,
            'content': h.content,
            'type': h.type,
            'category': h.category,
            'edited_at': h.edited_at.strftime('%Y-%m-%d %H:%M'),
            'edited_by': h.edited_by if h.edited_by else h.edited_by_ip
        })

    return jsonify(history_data)


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

# @app.route('/comments/<int:post_id>', methods=['GET'])
# def get_comments(post_id):
#     comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.timestamp.asc()).all()
#     return jsonify([{
#         'id': c.id,
#         'content': c.content,
#         'ip_address': c.ip_address,
#         'timestamp': c.timestamp.strftime('%Y-%m-%d %H:%M')
#     } for c in comments])

@app.route('/comments/<int:post_id>', methods=['GET'])
def get_comments(post_id):
    comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.timestamp.asc()).all()
    response = []

    for comment in comments:
        commenter = UserIP.query.filter_by(ip_address=comment.ip_address).first()
        if commenter:
            commented_by = commenter.username or commenter.ip_address
        else:
            commented_by = "Unknown"
        response.append({
            'id': comment.id,
            'content': comment.content,
            'ip_address': comment.ip_address,
            'commented_by': commented_by,
            'timestamp': comment.timestamp.strftime('%Y-%m-%d %H:%M')
        })
    return jsonify(response)

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
@app.route('/admin/dashboard')
def admin_dashboard():
    if not is_admin():
        return abort(403)

    total_posts = Post.query.count()
    total_comments = Comment.query.count()
    total_users = UserIP.query.count()
    total_notices = Notice.query.count()

    return render_template('admin_dashboard.html',
                           total_posts=total_posts,
                           total_comments=total_comments,
                           total_users=total_users,
                           total_notices=total_notices)


@app.route('/admin/posts')
def admin_posts():
    if request.remote_addr != ADMIN_IP:
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

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/why_bdf')
def why_bdf():
    return render_template('why_bdf.html')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='192.168.0.126', port=5000, debug=True)
