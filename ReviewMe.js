var EDITOR          = "editor";
var JS_REV_HEADER_S = "//////// JS_REVIEWER HEADER - START ////////"
var JS_REV_HEADER_E = "//////// JS_REVIEWER HEADER - END   ////////"
var REVIEW_COMMENTS = [];
var CUR_REVIEWER    = "";
var LINE_SEP        = '\n';
var FIELD_SEP       = ';';
var REV_INDEX       = -1;

class ReviewComment
{
    constructor(_reviewer, _fromrow, _fromcol, _torow, _tocol, _comment)
    {
        this.reviewer = _reviewer;
        this.fromrow  = _fromrow;
        this.fromcol  = _fromcol;
        this.torow    = _torow;
        this.tocol    = _tocol;
        this.comment  = _comment;
    }

    toString()
    {
        return `${this.reviewer} --> ${this.comment}`;
    }
};

function init_JS_Reviewer()
{
    editor.commands.addCommands([{
        name: 'nextReview',
        bindKey: {win: 'Alt-N',  mac: 'Option-N'},
        exec: function(editor) {
            nextReview();
        },
        readOnly: true
    },
    {
        name: 'previousReview',
        bindKey: {win: 'Alt-P',  mac: 'Option-P'},
        exec: function(editor) {
            previousReview();
        },
        readOnly: true
    },
    {
        name: 'deleteReview',
        bindKey: {win: 'Alt-D',  mac: 'Option-D'},
        exec: function(editor) {
            deleteReview(REV_INDEX);
        },
        readOnly: true
    },
    {
        name: 'createReview',
        bindKey: {win: 'Alt-C',  mac: 'Option-C'},
        exec: function(editor) {
            createReview();
        },
        readOnly: true
    },
    {
        name: 'toggleReviewMode',
        bindKey: {win: 'Alt-T',  mac: 'Option-T'},
        exec: function(editor) {
            toggleReviewMode();
        },
        readOnly: true
    },
    {
        name: 'askReviewer',
        bindKey: {win: 'Alt-R',  mac: 'Option-R'},
        exec: function(editor) {
            askReviewer();
        },
        readOnly: true
    }]);
}

function changeTheme(newTheme)
{
    ace.edit(EDITOR).setOption("theme", "ace/theme/" + newTheme);
}

// MODE SWITCHING
{
    function isReviewMode()
    {
        return ace.edit(EDITOR).getReadOnly();
    }

    function toggleReviewMode()
    {
        if (isReviewMode())
        {
            extractReviews();
        }
        else
        {
            digestReviews();
        }
    }

    function digestReviews()
    {
        if (isReviewMode())
        {
            return;
        }

        var editor = ace.edit(EDITOR);
        var session = editor.getSession();
        var lines = session.getDocument().getAllLines();

        if (lines[0] != JS_REV_HEADER_S)
        {
        	alert("Invalid JS_REVIEWER header. Ignoring 'digest' request.");
        	return;
        }
        editor.setReadOnly(true);

        clearReviews();

        var ignore = '', language = '';
        [ignore, language] = lines[1].split(FIELD_SEP);
        var nComments = 0;
        var reviewer2reviewsNumber = [];
        var skip = 2;
        for (i in lines)
        {
            if (skip)
            {
                skip--;
                continue;
            }

            if (lines[i] == JS_REV_HEADER_E)
            {
                break;
            }

            var reviewer = '', sfromrow = '', sfromcol = '', storow = '', stocol = '', comment = '';
            [reviewer, sfromrow, sfromcol, storow, stocol, comment] = lines[i].split(FIELD_SEP);

            _createReview(new ReviewComment(reviewer, parseInt(sfromrow), parseInt(sfromcol), parseInt(storow), parseInt(stocol), comment));

            if (reviewer2reviewsNumber[reviewer] == undefined)
            {
                reviewer2reviewsNumber[reviewer] = 1;
            }
            else
            {
                reviewer2reviewsNumber[reviewer]++;
            }
        }

        session.setMode("ace/mode/" + language);
        session.getDocument().removeFullLines(0, 2 + REVIEW_COMMENTS.length);
        editor.clearSelection();
        editor.navigateFileStart();

        for (var reviewer in reviewer2reviewsNumber)
        {
            console.log(`${reviewer} : ${reviewer2reviewsNumber[reviewer]} reviews`);
        }
    }

    function extractReviews()
    {
        if (!isReviewMode())
        {
            return;
        }

        var editor    = ace.edit(EDITOR);
        var language  = editor.session.getMode().$id.slice(9);
        var res       = JS_REV_HEADER_S;

        res += `${LINE_SEP}Language${FIELD_SEP}${language}`;

        for (var i = 0 ; i < REVIEW_COMMENTS.length ; i++)
        {
            var review = REVIEW_COMMENTS[i];
            res += `${LINE_SEP}${review.reviewer}${FIELD_SEP}${review.fromrow}${FIELD_SEP}${review.fromcol}${FIELD_SEP}${review.torow}${FIELD_SEP}${review.tocol}${FIELD_SEP}${review.comment}`;
        }

        res += `${LINE_SEP}${JS_REV_HEADER_E}${LINE_SEP}`;

        clearReviews();

        editor.clearSelection();
        editor.session.insert({row : 0, column : 0}, res);
        editor.navigateFileEnd();
        editor.selectAll();
        editor.session.setMode("ace/mode/plain_text");
        editor.setReadOnly(false);
    }
}

// REVIEW CREATION
{
    function askReviewer()
    {
        if (!isReviewMode())
        {
            return;
        }

        var res = prompt("Who are you ?");
        if (res == null || res == "")
        {
            res = "???";
        }
        CUR_REVIEWER = res;
    }

    function _createReview(review)
    {
        if (!isReviewMode())
        {
            return;
        }

        REVIEW_COMMENTS.push(review);

        var new_rev = document.getElementById("review_template").cloneNode(true);
        new_rev.id = `rev_${REVIEW_COMMENTS.length - 1}`;
        new_rev.children[0].innerText = review.toString();
        document.getElementById("review_list").appendChild(new_rev);
        new_rev.style.display = '';
    }

    function createReview()
    {
        if (!isReviewMode())
        {
            return;
        }

        var editor = ace.edit(EDITOR);
        var range = editor.getSelectionRange();

        if (range.isEmpty())
        {
            alert('Some code have to be selected to create a review');
            return;
        }

        if (CUR_REVIEWER == "")
        {
            askReviewer();
        }

        var comment = prompt("Comment :");
        if (comment == null || comment == "")
        {
            alert("Empty comment. Discarded.")
            return;
        }

        var review = new ReviewComment(CUR_REVIEWER, range.start.row, range.start.column, range.end.row, range.end.column, comment);

        _createReview(review);
    }
}

// REVIEW DELETION
{
    function clearReviews()
    {
        if (!isReviewMode())
        {
            return;
        }

        REVIEW_COMMENTS = [];
        REV_INDEX = -1;

        var list = document.getElementById("review_list");
        while (list.firstChild)
        {
            list.removeChild(list.firstChild);
        }
    }

    function deleteReviewById(id)
    {
        if (!isReviewMode())
        {
            return;
        }

        var index = parseInt(id.slice(4));

        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        deleteReview(index);
    }

    function deleteReview(index)
    {
        if (!isReviewMode())
        {
            return;
        }

        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        if (REV_INDEX >= 0 && REV_INDEX < REVIEW_COMMENTS.length)
        {
            document.getElementById('rev_'+REV_INDEX).classList.remove("w3-light-blue");
            document.getElementById('rev_'+REV_INDEX).classList.add("w3-blue-grey");
            REV_INDEX = -1;
        }

        REVIEW_COMMENTS.splice(index, 1);
        var rev = document.getElementById('rev_' + index);
        var list = rev.parentNode;
        list.removeChild(rev);
        ace.edit(EDITOR).clearSelection();

        for (var i = index ; i < REVIEW_COMMENTS.length ; i++)
        {
            list.children[i].id = "rev_" + i;
        }
    }
}

// REVIEW BROWSING
{
    function nextReview()
    {
        if (!isReviewMode())
        {
            return;
        }

        if (REVIEW_COMMENTS.length == 0)
        {
            return;
        }

        selectReview((REV_INDEX + 1) % REVIEW_COMMENTS.length);
    }

    function previousReview()
    {
        if (!isReviewMode())
        {
            return;
        }

        if (REVIEW_COMMENTS.length == 0)
        {
            return;
        }

        selectReview((REV_INDEX + REVIEW_COMMENTS.length - 1) % REVIEW_COMMENTS.length);
    }

    function selectReviewById(id)
    {
        var index = parseInt(id.slice(4));

        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        selectReview(index);
    }

    function selectReview(index)
    {
        if (!isReviewMode())
        {
            return;
        }

        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        var editor = ace.edit(EDITOR);
        var review  = REVIEW_COMMENTS[index];
        var range = editor.getSelectionRange();
        var select_color = 'w3-blue-grey';
        var unselect_color = 'w3-grey';

        if (REV_INDEX >= 0 && REV_INDEX < REVIEW_COMMENTS.length)
        {
            document.getElementById('rev_'+REV_INDEX).classList.remove(select_color);
            document.getElementById('rev_'+REV_INDEX).classList.add(unselect_color);
        }

        REV_INDEX = index;

        range.setStart(review.fromrow, review.fromcol);
        range.setEnd(review.torow, review.tocol);
        editor.getSession().getSelection().setSelectionRange(range);

        document.getElementById('rev_'+REV_INDEX).classList.remove(unselect_color);
        document.getElementById('rev_'+REV_INDEX).classList.add(select_color);
    }
}
